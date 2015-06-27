'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var events = require('events')
var cclib = require('coloredcoinjs-lib')
var Promise = require('bluebird')
var makeConcurrent = require('make-concurrent')(Promise)

var bitcoinUtil = require('../util/bitcoin')

/**
 * @event CoinManager#touchAddress
 * @param {string} address
 * @param {string} txid
 */

/**
 * @event CoinManager#touchAsset
 * @param {string} moniker
 * @param {string} txid
 */

/**
 * @class CoinManager
 * @extends {event.EventEmitter}
 * @param {Wallet} wallet
 * @param {ILockTimeStorage} storage
 */
function CoinManager (wallet, storage) {
  var self = this
  events.EventEmitter.call(self)

  self._wallet = wallet
  self._storage = storage

  self._coins = []
  self._spend = {}

  self._withLock = makeConcurrent(function (fn) { return fn() })
}

inherits(CoinManager, events.EventEmitter)

/**
 * @param {bitcore.Transaction} tx
 * @return {Promise.<AssetDefinition[]>}
 */
CoinManager.prototype._getAssets = function (tx) {
  var self = this
  var cdefClss = [
    cclib.definitions.EPOBC
  ]
  var getTxFn = self._wallet.createGetTxFn()

  return Promise.all(cdefClss, function (cdefCls) {
    return self._wallet.colorData.getTxColorValues(
      tx, null, cdefCls, getTxFn)
  })
  .then(function (aColorValues) {
    var cdescs = _.chain(aColorValues)
      .pluck('outputs')
      .flatten()
      .map(function (colorValue) {
        return colorValue.getColorDefinition().getDesc()
      })
      .uniq()
      .value()

    return Promise.map(cdescs, function (cdesc) {
      return self._wallet.assetManager.get({cdesc: cdesc})
    })
  })
  .then(function (adefs) {
    return _.uniq(_.filter(adefs), function (adef) { return adef.getId() })
  })
}

/**
 * @param {bitcore.Transaction} tx
 * @param {function} emit
 * @return {Promise}
 */
CoinManager.prototype._addTx = function (tx, emit) {
  var self = this
  return self._withLock(function () {
    var txid = tx.id

    tx.inputs.forEach(function (input) {
      var txid = input.prevTxId.toString('hex')
      self._spend = _.union(self._spend[txid], input.outputIndex)
    })

    return self._wallet.getAllAddresses()
      .then(function (walletAddresses) {
        // add coins and generate touchAddress
        var network = self._wallet.bitcoinNetwork
        return Promise.map(tx.outputs, function (output, oidx) {
          var touchedAddresses = _.intersection(
            bitcoinUtil.script2addresses(output.script, network),
            walletAddresses)

          if (touchedAddresses.length === 0) {
            return
          }

          return self._storage.get(txid, oidx)
            .then(function (lockTime) {
              self._coins.push({
                txid: txid,
                oidx: oidx,
                value: output.satoshis,
                script: output.script.toString('hex'),
                addresses: touchedAddresses,
                locktime: lockTime
              })
              return touchedAddresses
            })
        })
        .then(function (touched) {
          _.uniq(_.flatten(touched)).forEach(function (address) {
            emit('touchAddress', address, txid)
          })
        })
      })
      .then(function () {
        // calculate color values and generate touchAsset
        return self._getAssets()
      })
      .then(function (adefs) {
        adefs.forEach(function (adef) {
          emit('touchAsset', adef, txid)
        })
      })
  })
}

/**
 * @param {bitcore.Transaction} tx
 * @return {Promise}
 */
CoinManager.prototype.loadTx = function (tx) {
  return this._addTx(tx, _.noop)
}

/**
 * @param {bitcore.Transaction} tx
 * @return {Promise}
 */
CoinManager.prototype.addTx = function (tx) {
  return this._addTx(tx, this.emit.bind(this))
}

/**
 * @param {bitcore.Transaction} tx
 * @return {Promise}
 */
CoinManager.prototype.removeTx = function (tx) {
  var self = this
  return self._withLock(function () {
    var txid = tx.id

    tx.inputs.forEach(function (input) {
      var txid = input.prevTxId.toString('hex')
      self._spend[txid] = _.without(self._spend[txid], input.index)
      if (self._spend[txid].length === 0) {
        delete self._spend[txid]
      }
    })

    return self._wallet.getAllAddresses()
      .then(function (walletAddresses) {
        var removedCoins = _.filter(self._coins, {txid: txid})
        return Promise.map(removedCoins, function (coin) {
          return self._storage.remove(coin.txid, coin.oidx)
        })
        .then(function () {
          self._coins = _.reject(self._coins, {txid: txid})

          _.chain(removedCoins)
            .pluck('addresses')
            .flatten()
            .uniq()
            .intersection()
            .forEach(function (address) {
              self.emit('touchAddress', address, txid)
            })

          return self._getAssets(tx)
        })
      })
      .then(function (adefs) {
        adefs.forEach(function (adef) {
          self.emit('touchAsset', adef, txid)
        })
      })
  })
}

/**
 * @param {Array.<{txid: string, oidx: number}>} coins
 * @param {?number} lockTime
 * @return {Promise}
 */
CoinManager.prototype._changeLockTime = function (coins, lockTime) {
  var self = this
  return self._withLock(function () {
    // first, find all coins
    var records = coins.map(function (coin) {
      var row = _.find(self._coins, {txid: coin.txid, oidx: coin.oidx})
      if (row === undefined) {
        throw new Error('Coin not found: ' + coin.txid + ':' + coin.oidx)
      }

      return row
    })

    // set lockTime in storage and after in record
    return Promise.map(records, function (record) {
      return Promise.try(function () {
        if (lockTime === null) {
          return self._storage.remove(record.txid, record.oidx)
        }

        return self._storage.set(record.txid, record.oidx, lockTime)
      })
      .then(function () {
        record.lockTime = lockTime
      })
    })
  })
}

/**
 * @param {Array.<{txid: string, oidx: number}>} coins
 * @param {Object} opts Freeze options
 * @param {number} [opts.height] Until height is not be reached
 * @param {number} [opts.timestamp] Until timestamp not be reached (in seconds)
 * @param {number} [opts.fromNow] Freeze for given number in seconds
 * @return {Promise}
 */
CoinManager.prototype.freezeCoins = function (coins, opts) {
  var lockTime = opts.height ||
                 opts.timestamp ||
                 opts.fromNow + Math.round(Date.now() / 1000)

  if (lockTime < 0) {
    throw new Error('lockTime must be greater than or equal zero')
  }

  return this._changeLockTime(coins, lockTime)
}

/**
 * @param {Array.<{txid: string, oidx: number}>} coins
 * @return {Promise}
 */
CoinManager.prototype.unfreezeCoins = function (coins) {
  return this._changeLockTime(coins, null)
}

module.exports = CoinManager
