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
 */
function CoinManager (wallet) {
  var self = this
  events.EventEmitter.call(self)

  self._wallet = wallet

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
 * @param {boolean} emit
 * @return {Promise}
 */
CoinManager.prototype._addTx = function (tx, emit) {
  var self = this
  var callEmit = emit === true ? self.emit.bind(self) : _.noop
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

          if (touchedAddresses.length > 0) {
            self._coins.push({
              txid: txid,
              oidx: oidx,
              value: output.satoshis,
              script: output.script.toString('hex'),
              addresses: touchedAddresses,
              locktime: 0
            })
          }

          return touchedAddresses
        })
        .then(function (touched) {
          _.uniq(_.flatten(touched)).forEach(function (address) {
            callEmit('touchAddress', address, txid)
          })
        })
      })
      .then(function () {
        // calculate color values and generate touchAsset
        return self._getAssets()
      })
      .then(function (adefs) {
        adefs.forEach(function (adef) {
          callEmit('touchAsset', adef, txid)
        })
      })
  })
}

/**
 * @param {bitcore.Transaction} tx
 * @return {Promise}
 */
CoinManager.prototype.loadTx = function (tx) {
  return this._addTx(tx, false)
}

/**
 * @param {bitcore.Transaction} tx
 * @return {Promise}
 */
CoinManager.prototype.addTx = function (tx) {
  return this._addTx(tx, true)
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
      .then(function (adefs) {
        adefs.forEach(function (adef) {
          self.emit('touchAsset', adef, txid)
        })
      })
  })
}

module.exports = CoinManager
