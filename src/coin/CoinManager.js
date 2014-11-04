var events = require('events')
var inherits = require('util').inherits

var _ = require('lodash')
var Q = require('q')

var cclib = require('../cclib')
var bitcoin = require('../bitcoin')
var Coin = require('./Coin')
var verify = require('../verify')


/**
 * @event CoinManager#error
 * @param {Error} error
 */

/**
 * @event CoinManager#touchAddress
 * @param {string} address
 */

/**
 * @class CoinManager
 * @extends events.EventEmitter
 * @param {Wallet} wallet
 * @param {CoinStorage} storage
 */
function CoinManager(wallet, storage) {
  verify.Wallet(wallet)
  verify.CoinStorage(storage)

  var self = this
  events.EventEmitter.call(self)

  self._wallet = wallet
  self._storage = storage


  function getAllAddresses() {
    return _.chain(self._wallet.getAllAssetDefinitions())
      .map(function(assetdef) { return self._wallet.getAllAddresses(assetdef) })
      .flatten()
      .uniq()
      .value()
  }

  self._wallet.getTxDb().on('addTx', function(tx) {
    var txId = tx.getId()
    var allAddresses = getAllAddresses()

    tx.ins.forEach(function(input) {
      var txId = Array.prototype.reverse.call(new Buffer(input.hash)).toString('hex')
      self._storage.markCoinAsSpent(txId, input.index)
    })

    var promises = tx.outs.map(function(output, index) {
      var outputAddresses = bitcoin.getAddressesFromOutputScript(
        output.script, self._wallet.getBitcoinNetwork())
      var walletAddresses = _.intersection(allAddresses, outputAddresses)
      if (walletAddresses.length === 0)
        return

      self._storage.addCoin(txId, index, {
        value: output.value,
        script: output.script.toHex(),
        addresses: outputAddresses
      })

      var coin = self.record2Coin({
        txId: txId,
        outIndex: index,
        value: output.value,
        script: output.script.toHex(),
        address: walletAddresses[0]
      })

      return Q.ninvoke(coin, 'getMainColorValue').then(function() {
        walletAddresses.forEach(function(address) {
          self.emit('touchAddress', address)
        })
      })
    })

    Q.all(promises).catch(function(error) { self.emit('error', error) })
  })

  self._wallet.getTxDb().on('revertTx', function(tx) {
    var txId = tx.getId()
    var allAddresses = getAllAddresses()

    tx.ins.forEach(function(input) {
      var txId = Array.prototype.reverse.call(new Buffer(input.hash)).toString('hex')
      self._storage.markCoinAsUnspent(txId, input.index)
    })

    tx.outs.map(function(output, index) {
      var coinRecord = self._storage.removeCoin(txId, index)
      self._wallet.getColorData().removeColorValues(txId, index)
      coinRecord.addresses.forEach(function(address) {
        self.emit('touchAddress', address)
      })
    })
  })
}

inherits(CoinManager, events.EventEmitter)

/**
 * @param {CoinStorageRecord} record
 * @return {Coin}
 */
CoinManager.prototype.record2Coin = function(record) {
  verify.rawCoin(record)

  var coin = new Coin(this, {
    txId: record.txId,
    outIndex: record.outIndex,
    value: record.value,
    script: record.script,
    address: record.address
  })

  return coin
}

/**
 * @param {string} address
 * @return {Coin[]}
 */
CoinManager.prototype.getCoinsForAddress = function(address) {
  verify.string(address)

  var records = this._storage.getCoinsForAddress(address)
  records.forEach(function(record) { record.address = address })
  return records.map(this.record2Coin.bind(this))
}

/**
 * @param {Coin} coin
 * @return {boolean}
 */
CoinManager.prototype.isCoinSpent = function(coin) {
  verify.Coin(coin)

  return this._storage.isSpent(coin.txId, coin.outIndex)
}

/**
 * @param {Coin} coin
 * @return {boolean}
 */
CoinManager.prototype.isCoinConfirmed = function(coin) {
  verify.Coin(coin)

  return this._wallet.getTxDb().isTxConfirmed(coin.txId)
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
CoinManager.prototype.getCoinColorValue = function(coin, colorDefinition, cb) {
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
CoinManager.prototype.getCoinMainColorValue = function(coin, cb) {
  verify.Coin(coin)
  verify.function(cb)

  var cdManager = this._wallet.getColorDefinitionManager()

  Q.fcall(function() {
    var coinColorValue = null

    var promises = cdManager.getAllColorDefinitions().map(function(colorDefinition) {
      return Q.ninvoke(coin, 'getColorValue', colorDefinition).then(function(colorValue) {
        if (coinColorValue !== null && colorValue !== null)
          throw new Error('Coin ' + coin + ' have more that one ColorValue')

        if (coinColorValue === null)
          coinColorValue = colorValue
      })
    })

    return Q.all(promises).then(function() { return coinColorValue })

  }).then(function(coinColorValue) {
    if (coinColorValue === null)
      coinColorValue = new cclib.ColorValue(cdManager.getUncolored(), coin.value)

    return coinColorValue

  }).done(function(coinColorValue) { cb(null, coinColorValue) }, function(error) { cb(error) })
}


module.exports = CoinManager
