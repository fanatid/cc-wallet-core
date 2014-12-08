var events = require('events')
var inherits = require('util').inherits

var _ = require('lodash')
var Q = require('q')

var cclib = require('../cclib')
var txStatus = require('../const').txStatus
var bitcoin = require('../bitcoin')
var Coin = require('./Coin')
var verify = require('../verify')
var SyncMixin = require('../SyncMixin')


/**
 * @event CoinManager#error
 * @param {Error} error
 */

/**
 * @event CoinManager#touchAddress
 * @param {string} address
 */

/**
 * @event CoinManager#touchAsset
 * @param {AssetDefinition} asset
 */

/**
 * @event CoinManager#syncStart
 */

/**
 * @event CoinManager#syncStop
 */

/**
 * @class CoinManager
 * @extends events.EventEmitter
 * @mixes SyncMixin
 * @param {Wallet} wallet
 * @param {CoinStorage} storage
 */
function CoinManager(wallet, storage) {
  verify.Wallet(wallet)
  verify.CoinStorage(storage)

  var self = this
  events.EventEmitter.call(self)
  SyncMixin.call(self)

  self._wallet = wallet
  self._storage = storage

  self._wallet.getTxDb().on('addTx', self._addTx.bind(self))
  self._wallet.getTxDb().on('revertTx', self._revertTx.bind(self))

  var txdb = self._wallet.getTxDb()
  _.chain(txdb.getAllTxIds())
    .filter(function (txId) { return txStatus.isValid(txdb.getTxStatus(txId)) })
    .map(txdb.getTx.bind(txdb))
    .forEach(self._addTx.bind(self))
}

inherits(CoinManager, events.EventEmitter)

/**
 * @param {CoinStorageRecord} record
 * @return {Coin}
 */
CoinManager.prototype._record2Coin = function (record) {
  var rawCoin = {
    txId: record.txId,
    outIndex: record.outIndex,
    value: record.value,
    script: record.script,
    address: record.address
  }
  var coinTxStatus = this._wallet.getTxDb().getTxStatus(rawCoin.txId)
  if (coinTxStatus === null) {
    throw new Error('Can\'t find tx for coin: ' + record.txId + ':' + record.outIndex)
  }

  var opts = {
    isSpent: this._storage.isSpent(rawCoin.txId, rawCoin.outIndex),
    isValid: txStatus.isValid(coinTxStatus),
    isAvailable: txStatus.isAvailable(coinTxStatus)
  }

  return new Coin(this, rawCoin, opts)
}

/**
 * @param {Transaction} tx
 */
CoinManager.prototype._addTx = function (tx) {
  verify.Transaction(tx)

  var self = this

  self._syncEnter()

  var txId = tx.getId()
  var allAddresses = self._wallet.getAllAddresses()

  tx.ins.forEach(function (input) {
    var txId = Array.prototype.reverse.call(new Buffer(input.hash)).toString('hex')
    self._storage.markCoinAsSpent(txId, input.index)
  })

  var promises = tx.outs.map(function (output, index) {
    if (self._storage.isCoinExists(txId, index)) {
      return
    }

    var outputAddresses = bitcoin.getAddressesFromOutputScript(
      output.script, self._wallet.getBitcoinNetwork())
    var walletAddresses = _.intersection(allAddresses, outputAddresses)
    if (walletAddresses.length === 0) {
      return
    }

    self._storage.addCoin(txId, index, {
      value: output.value,
      script: output.script.toHex(),
      addresses: outputAddresses
    })

    var coin = self._record2Coin({
      txId: txId,
      outIndex: index,
      value: output.value,
      script: output.script.toHex(),
      address: walletAddresses[0]
    })

    return Q.ninvoke(coin, 'getMainColorValue').then(function (colorValue) {
      var colorDesc = colorValue.getColorDefinition().getDesc()
      var assetdef = self._wallet.getAssetDefinitionManager().getByDesc(colorDesc)
      self.emit('touchAsset', assetdef)

      walletAddresses.forEach(function (address) {
        self.emit('touchAddress', address)
      })
    })
  })

  Q.all(promises).finally(function () {
    self._syncExit()

  }).catch(function (error) {
    self.emit('error', error)

  })
}

/**
 * @param {Transaction} tx
 */
CoinManager.prototype._revertTx = function (tx) {
  verify.Transaction(tx)

  var self = this

  self._syncEnter()

  var txId = tx.getId()
  var allAddresses = self._wallet.getAllAddresses()

  tx.ins.forEach(function (input) {
    var txId = Array.prototype.reverse.call(new Buffer(input.hash)).toString('hex')
    self._storage.markCoinAsUnspent(txId, input.index)
  })

  var promises = tx.outs.map(function (output, index) {
    var coinRecord = self._storage.removeCoin(txId, index)
    if (coinRecord === null) {
      return
    }

    var coin = self._record2Coin(coinRecord)
    return Q.ninvoke(coin, 'getMainColorValue').then(function (colorValue) {
      var colorDesc = colorValue.getColorDefinition().getDesc()
      var assetdef = self._wallet.getAssetDefinitionManager().getByDesc(colorDesc)
      self.emit('touchAsset', assetdef)

      self._wallet.getColorData().removeColorValues(txId, index)
      _.intersection(coinRecord.addresses, allAddresses).forEach(function (address) {
        self.emit('touchAddress', address)
      })

    })
  })

  Q.all(promises).finally(function () {
    self._syncExit()

  }).catch(function (error) {
    self.emit('error', error)

  })
}

/**
 * @param {string} address
 * @return {Coin[]}
 */
CoinManager.prototype.getCoinsForAddress = function (address) {
  verify.string(address)

  var records = this._storage.getCoinsForAddress(address)
  records.forEach(function (record) { record.address = address })
  return records.map(this._record2Coin.bind(this))
}

/**
 * @param {Coin} coin
 * @return {boolean}
 */
CoinManager.prototype.isCoinSpent = function (coin) {
  verify.Coin(coin)

  return this._storage.isSpent(coin.txId, coin.outIndex)
}

/**
 * @param {Coin} coin
 * @return {boolean}
 */
CoinManager.prototype.isCoinValid = function (coin) {
  verify.Coin(coin)

  var coinTxStatus = this._wallet.getTxDb().getTxStatus(coin.txId)
  return txStatus.isValid(coinTxStatus)
}

/**
 * @param {Coin} coin
 * @return {boolean}
 */
CoinManager.prototype.isCoinAvailable = function (coin) {
  verify.Coin(coin)

  var coinTxStatus = this._wallet.getTxDb().getTxStatus(coin.txId)
  return txStatus.isAvailable(coinTxStatus)
}

/**
 * @callback CoinManager~getCoinColorValue
 * @param {?Error} error
 * @param {ColorValue} colorValue
 */

/**
 * @param {Coin} coin
 * @param {ColorDefinition} colorDefinition
 * @param {CoinManager~getCoinColorValue} cb
 */
CoinManager.prototype.getCoinColorValue = function (coin, colorDefinition, cb) {
  verify.Coin(coin)
  verify.ColorDefinition(colorDefinition)
  verify.function(cb)

  var bs = this._wallet.getBlockchain()
  this._wallet.getColorData().getColorValue(coin.txId, coin.outIndex, colorDefinition, bs.getTx.bind(bs), cb)
}

/**
 * @callback CoinManager~getMainColorValue
 * @param {?Error} error
 * @param {ColorValue} coinColorValue
 */

/**
 * Get one ColorValue or error if more than one
 *
 * @param {Coin} coin
 * @param {CoinManager~getMainColorValue} cb
 */
// Todo: add synchronization from one coin
CoinManager.prototype.getCoinMainColorValue = function (coin, cb) {
  verify.Coin(coin)
  verify.function(cb)

  var cdManager = this._wallet.getColorDefinitionManager()

  Q.fcall(function () {
    var coinColorValue = null

    var promises = cdManager.getAllColorDefinitions().map(function (colorDefinition) {
      return Q.ninvoke(coin, 'getColorValue', colorDefinition).then(function (colorValue) {
        if (coinColorValue !== null && colorValue !== null) {
          throw new Error('Coin ' + coin + ' have more that one ColorValue')
        }

        if (coinColorValue === null) {
          coinColorValue = colorValue
        }
      })
    })

    return Q.all(promises).then(function () { return coinColorValue })

  }).then(function (coinColorValue) {
    if (coinColorValue === null) {
      coinColorValue = new cclib.ColorValue(cdManager.getUncolored(), coin.value)
    }

    return coinColorValue

  }).done(function (coinColorValue) { cb(null, coinColorValue) }, function (error) { cb(error) })
}


module.exports = CoinManager
