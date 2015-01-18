var events = require('events')
var inherits = require('util').inherits

var _ = require('lodash')
var Q = require('q')

var TX_STATUS = require('../const').TX_STATUS
var bitcoin = require('../bitcoin')
var errors = require('../errors')
var Coin = require('./Coin')
var verify = require('../verify')


/**
 * @event CoinManager#touchAddress
 * @param {string} address
 */

/**
 * @event CoinManager#newColor
 * @param {string} desc
 */

/**
 * @event CoinManager#touchAsset
 * @param {AssetDefinition} asset
 */

/**
 * @class CoinManager
 * @extends external:events.EventEmitter
 * @param {Wallet} wallet
 * @param {WalletState} walletState
 * @param {Object} rawStorage
 */
function CoinManager(wallet, walletState, rawStorage) {
  verify.Wallet(wallet)
  verify.WalletState(walletState)
  verify.object(rawStorage)

  events.EventEmitter.call(this)

  rawStorage = _.defaults(rawStorage, {coins: [], spend: {}, version: 1})

  this._wallet = wallet
  this._walletState = walletState
  this._coins = rawStorage.coins
  this._spend = rawStorage.spend
}

inherits(CoinManager, events.EventEmitter)

/**
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 * @return {external:Q.Promise}
 */
CoinManager.prototype.addTx = function (tx) {
  verify.Transaction(tx)

  var self = this
  var txId = tx.getId()

  tx.ins.forEach(function (input) {
    var txId = bitcoin.util.hashEncode(input.hash)
    self._spend[txId] = _.union(self._spend[txId], [input.index]).sort()
  })

  var network = self._wallet.getBitcoinNetwork()
  var walletAddresses = self._wallet.getAllAddresses()

  _.chain(tx.outs)
    .map(function (output, index) {
      var outputAddresses = bitcoin.util.getAddressesFromScript(output.script, network)
      var touchedAddresses = _.intersection(outputAddresses, walletAddresses)
      if (touchedAddresses.length > 0) {
        self._coins.push({
          txId: txId,
          outIndex: index,
          value: output.value,
          script: output.script.toHex(),
          addresses: touchedAddresses,
          lockTime: 0
        })

        return touchedAddresses
      }
    })
    .filter()
    .flatten()
    .uniq()
    .forEach(function (address) {
      self.emit('touchAddress', address)
    })

  var assetDefinitionManager = self._wallet.getAssetDefinitionManager()
  var wsm = self._wallet.getStateManager()
  return Q.ninvoke(wsm, 'getTxMainColorValues', tx, self._walletState).then(function (colorValues) {
    _.chain(colorValues)
      .map(function (cv) { return cv.getColorDefinition().getDesc() })
      .uniq()
      .map(function (desc) {
        var assetdef = assetDefinitionManager.getByDesc(desc)
        if (assetdef !== null) {
          return assetdef
        }

        self.emit('newColor', desc)
      })
      .filter()
      .uniq(function (assetdef) { return assetdef.getId() })
      .forEach(function (assetdef) {
        self.emit('touchAsset', assetdef)
      })
  })
}

/**
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 * @return {external:Q.Promise}
 */
CoinManager.prototype.updateTx = function () { return Q() }

/**
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 * @return {external:Q.Promise}
 */
CoinManager.prototype.revertTx = function (tx) {
  verify.Transaction(tx)

  var self = this
  var txId = tx.getId()

  tx.ins.forEach(function (input) {
    var txId = bitcoin.util.hashEncode(input.hash)
    self._spend[txId] = _.without(self._spend[txId], input.index)
    if (self._spend[txId].length === 0) {
      delete self._spend[txId]
    }
  })

  var rawCoins = _.filter(_.range(tx.outs.length).map(function (index) {
    return _.find(self._coins, {txId: txId, outIndex: index})
  }))
  self._coins = _.difference(self._coins, rawCoins)

  _.chain(rawCoins)
    .pluck('addresses')
    .flatten()
    .uniq()
    .intersection(self._wallet.getAllAddresses())
    .forEach(function (address) {
      self.emit('touchAddress', address)
    })

  var assetDefinitionManager = self._wallet.getAssetDefinitionManager()
  var wsm = self._wallet.getStateManager()
  return Q.ninvoke(wsm, 'getTxMainColorValues', tx, self._walletState).then(function (colorValues) {
    _.chain(colorValues)
      .map(function (cv) { return cv.getColorDefinition().getDesc() })
      .uniq()
      .map(function (desc) { return assetDefinitionManager.getByDesc(desc) })
      .filter()
      .uniq(function (assetdef) { return assetdef.getId() })
      .forEach(function (assetdef) {
        self.emit('touchAsset', assetdef)
      })
  })
}

/**
 * @param {Array.<{txId: string, outIndex: number}>} coins
 * @param {Object} opts Freeze options
 * @param {number} [opts.height] Freeze until height is not be reached
 * @param {number} [opts.timestamp] Freeze until timestamp is not be reached
 * @param {number} [opts.fromNow] As timestamp that equal (Date.now() + fromNow)
 * @throws {CoinNotFoundError} If coin for given txId:outIndex not found
 */
CoinManager.prototype.freezeCoins = function (coins, opts) {
  verify.array(coins)
  coins.forEach(function (coin) {
    verify.object(coin)
    verify.txId(coin.txId)
    verify.number(coin.outIndex)
  })

  verify.object(opts)
  var lockTime = opts.height || opts.timestamp || opts.fromNow + Date.now()
  verify.number(lockTime)
  if (lockTime < 0) {
    var errMsg = 'freezeCoins: lockTime must be greater than or equal zero'
    throw new errors.VerifyTypeError(errMsg)
  }

  var findRecord = _.partial(_.find, this._coins)
  coins.forEach(function (coin) {
    var record = findRecord({txId: coin.txId, outIndex: coin.outIndex})
    if (_.isUndefined(record)) {
      throw new errors.CoinNotFoundError('Coin: ' + coin.txId + ':' + coin.outIndex)
    }

    record.lockTime = lockTime
  })
}

/**
 * @param {Array.<{txId: string, outIndex: number}>} coins
 * @throws {CoinNotFoundError} If coin for given txId:outIndex not found
 */
CoinManager.prototype.unfreezeCoins = function (coins) {
  this.freezeCoin(coins, {height: 0})
}

/**
 * @param {(string|string[])} [addresses]
 * @return {Coin[]}
 */
CoinManager.prototype.getCoins = function (addresses) {
  var self = this

  var rawCoins = self._coins
  if (!_.isUndefined(addresses)) {
    if (!_.isArray(addresses)) {
      addresses = [addresses]
    }

    verify.array(addresses)
    addresses.forEach(verify.string)
    rawCoins = rawCoins.filter(function (rawCoin) {
      return _.intersection(rawCoin.addresses, addresses).length > 0
    })
  }


  var coins = rawCoins.map(function (record) {
    var rawCoin = {
      txId: record.txId,
      outIndex: record.outIndex,
      value: record.value,
      script: record.script,
      address: record.addresses[0]
    }

    return new Coin(rawCoin, self._wallet)
  })

  return coins
}

/**
 * @param {{txId: string, outIndex: number}} coin
 * @return {boolean}
 */
CoinManager.prototype.isCoinSpent = function (coin) {
  verify.object(coin)
  verify.txId(coin.txId)
  verify.number(coin.outIndex)

  return (this._spend[coin.txId] || []).indexOf(coin.outIndex) !== -1
}

/**
 * @param {{txId: string} coin
 * @return {boolean}
 * @throws {TxNotFoundError} If tx for given coin not found
 */
CoinManager.prototype.isCoinValid = function (coin) {
  verify.object(coin)
  verify.txId(coin.txId)

  var coinTxStatus = this._walletState.getTxManager().getTxStatus(coin.txId)
  if (coinTxStatus === null) {
    throw new errors.TxNotFoundError('TxId: ' + coin.txId)
  }

  return TX_STATUS.isValid(coinTxStatus)
}

/**
 * @param {{txId: string} coin
 * @return {boolean}
 * @throws {TxNotFoundError} If tx for given coin not found
 */
CoinManager.prototype.isCoinAvailable = function (coin) {
  verify.object(coin)
  verify.txId(coin.txId)

  var coinTxStatus = this._walletState.getTxManager().getTxStatus(coin.txId)
  if (coinTxStatus === null) {
    throw new errors.TxNotFoundError('TxId: ' + coin.txId)
  }

  return TX_STATUS.isAvailable(coinTxStatus)
}

/**
 * @param {{txId: string, outIndex: number}} coin
 * @return {boolean}
 * @throws {CoinNotFoundError} If coin for given txId:outIndex not found
 */
CoinManager.prototype.isCoinFrozen = function (coin) {
  verify.object(coin)
  verify.txId(coin.txId)
  verify.number(coin.outIndex)

  var record = _.find(this._coins, {txId: coin.txId, outIndex: coin.outIndex})
  if (_.isUndefined(record)) {
    throw new errors.CoinNotFoundError('Coin: ' + coin.txId + ':' + coin.outIndex)
  }

  if (record.lockTime === 0) {
    return false
  }

  if (record.lockTime < 500000000) {
    var currentHeight = this._wallet.getBlockchain().getCurrentHeight()
    return record.lockTime > currentHeight
  }

  var currentTimestamp = Math.round(Date.now() / 1000)
  return record.lockTime > currentTimestamp
}


module.exports = CoinManager
