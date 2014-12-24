var events = require('events')
var inherits = require('util').inherits

var _ = require('lodash')
var Q = require('q')

var cclib = require('../cclib')
var txStatus = require('../const').txStatus
var bitcoin = require('../bitcoin')
var errors = require('../errors')
var Coin = require('./Coin')
var verify = require('../verify')


/**
 * @event CoinManager#touchAddress
 * @param {string} address
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
  rawStorage = _.defaults(rawStorage, {'coins': [], 'spend': {}})

  events.EventEmitter.call(this)

  this._wallet = wallet
  this._walletState = walletState
  this._coins = rawStorage.coins
  this._spend = rawStorage.spend
}

inherits(CoinManager, events.EventEmitter)

/**
 * @private
 * @param {Coin~RawCoin} record
 * @return {Coin}
 */
CoinManager.prototype._record2Coin = function (record) {
  var txData = this._walletState.getTxManager().getTxData(record.txId)
  if (txData === null) {
    throw new errors.TxNotFoundError('TxId: ' + record.txId)
  }

  var opts = {
    isSpent: (this._spend[record.txId] || []).indexOf(record.outIndex) !== -1,
    isValid: txStatus.isValid(txData.status),
    isAvailable: txStatus.isAvailable(txData.status)
  }

  return new Coin(this, record, opts)
}

/**
 * @private
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 * @return {external:Q.Promise}
 */
CoinManager.prototype.addTx = function (tx) {
  verify.Transaction(tx)

  var self = this
  var txId = tx.getId()

  tx.ins.forEach(function (input) {
    var txId = Array.prototype.reverse.call(new Buffer(input.hash)).toString('hex')
    self._spend[txId] = _.union(self._spend[txId], [input.index]).sort()
  })

  var network = self._wallet.getBitcoinNetwork()
  var walletAddresses = self._wallet.getAllAddresses()

  _.chain(tx.outs)
    .map(function (output, index) {
      var outputAddresses = bitcoin.getAddressesFromOutputScript(output.script, network)
      var touchedAddresses = _.intersection(outputAddresses, walletAddresses)
      if (touchedAddresses.length > 0) {
        self._coins.push({
          txId: txId,
          outIndex: index,
          value: output.value,
          script: output.script.toHex(),
          addresses: touchedAddresses
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
  return self.getTxMainColorValues(tx).then(function (colorValues) {
    _.chain(colorValues)
      .map(function (cv) { return cv.getColorDefinition().getDesc() })
      .uniq()
      .map(function (desc) { return assetDefinitionManager.getByDesc(desc) })
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
    var txId = Array.prototype.reverse.call(new Buffer(input.hash)).toString('hex')
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
  return self.getTxMainColorValues(tx).then(function (colorValues) {
    _.chain(colorValues)
      .map(function (cv) { return cv.getColorDefinition().getDesc() })
      .uniq()
      .map(function (desc) { return assetDefinitionManager.getByDesc(desc) })
      .uniq(function (assetdef) { return assetdef.getId() })
      .forEach(function (assetdef) {
        self.emit('touchAsset', assetdef)
      })
  })
}

/**
 * @param {(string|string[])} [addresses]
 * @return {Coin[]}
 */
CoinManager.prototype.getCoins = function (addresses) {
  var rawCoins = this._coins
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

  var record2Coin = this._record2Coin.bind(this)
  var coins = rawCoins.map(function (record) {
    return record2Coin({
      txId: record.txId,
      outIndex: record.outIndex,
      value: record.value,
      script: record.script,
      address: record.addresses[0]
    })
  })

  return coins
}

/**
 * @param {Coin} coin
 * @return {boolean}
 */
CoinManager.prototype.isCoinSpent = function (coin) {
  verify.Coin(coin)

  return (this._spend[coin.txId] || []).indexOf(coin.outIndex) !== -1
}

/**
 * @param {Coin} coin
 * @return {boolean}
 */
CoinManager.prototype.isCoinValid = function (coin) {
  verify.Coin(coin)

  var txData = this._walletState.getTxManager().getTxData(coin.txId)
  return txData !== null && txStatus.isValid(txData.status)
}

/**
 * @param {Coin} coin
 * @return {boolean}
 */
CoinManager.prototype.isCoinAvailable = function (coin) {
  verify.Coin(coin)

  var txData = this._walletState.getTxManager().getTxData(coin.txId)
  return txData !== null && txStatus.isAvailable(txData.status)
}

/**
 * @callback CoinManager~getCoinColorValueCallback
 * @param {?Error} error
 * @param {external:coloredcoinjs-lib.ColorValue} colorValue
 */

/**
 * @param {Coin} coin
 * @param {external:coloredcoinjs-lib.ColorDefinition} colorDefinition
 * @param {CoinManager~getCoinColorValueCallback} cb
 */
CoinManager.prototype.getCoinColorValue = function (coin, colorDefinition, cb) {
  verify.Coin(coin)
  verify.ColorDefinition(colorDefinition)
  verify.function(cb)

  var bs = this._wallet.getBlockchain()
  this._wallet.getColorData().getColorValue(coin.txId, coin.outIndex, colorDefinition, bs.getTx.bind(bs), cb)
}

/**
 * @param {Coin} coin
 * @param {CoinManager~getCoinColorValueCallback} cb
 */
CoinManager.prototype.getCoinMainColorValue = function (coin, cb) {
  verify.Coin(coin)
  verify.function(cb)

  var cdManager = this._wallet.getColorDefinitionManager()

  Q.fcall(function () {
    var coinColorValue = null

    var promises = cdManager.getAllColorDefinitions().map(function (colorDefinition) {
      return Q.ninvoke(coin, 'getColorValue', colorDefinition).then(function (colorValue) {
        if (coinColorValue !== null && colorValue !== null) {
          var rawCoin = coin.toRawCoin()
          var msg = rawCoin.txId + ':' + rawCoin.outIndex + ' have more than one ColorValue'
          throw new errors.CoinColorValueError(msg)
        }

        if (coinColorValue === null) {
          coinColorValue = colorValue
        }
      })
    })

    return Q.all(promises).then(function () { return coinColorValue })

  }).then(function (coinColorValue) {
    if (coinColorValue === null) {
      coinColorValue = new cclib.ColorValue(cclib.ColorDefinitionManager.getUncolored(), coin.value)
    }

    return coinColorValue

  }).done(function (coinColorValue) { cb(null, coinColorValue) }, function (error) { cb(error) })
}

/**
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 * @return {external:Q.Promise<external:coloredcoinjs-lib.ColorValue[]>}
 */
CoinManager.prototype.getTxMainColorValues = function (tx) {
  var self = this

  var colorDefinitions = self._wallet.getColorDefinitionManager().getAllColorDefinitions()
  return Q.all(colorDefinitions.map(function (colorDefinition) {
    var blockchain = self._wallet.getBlockchain()
    function getTxFn(txId, cb) {
      blockchain.getTx(txId, self._walletState, cb)
    }

    return Q.ninvoke(self._wallet.getColorData(), 'getTxColorValues', tx, colorDefinition, getTxFn)

  })).then(function (colorValuess) {
    var nullColorValues = Array.apply(null, Array(tx.outs.length)).map(function () { return null })
    var colorValues = colorValuess.reduce(function (colorValues1, colorValues2) {
      return colorValues1.map(function (cv, index) {
        if (cv !== null) {
          if (colorValues2[index] !== null) {
            throw new errors.CoinColorValueError(tx.getId() + ':' + index + ' have more than one ColorValue')
          }

          return cv
        }

        return colorValues2[index]
      })
    }, nullColorValues)

    var uncolored = cclib.ColorDefinitionManager.getUncolored()
    return colorValues.map(function (cv, index) {
      if (cv !== null) {
        return cv
      }

      return new cclib.ColorValue(uncolored, tx.outs[index].value)
    })
  })
}


module.exports = CoinManager
