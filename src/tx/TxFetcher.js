var events = require('events')
var inherits = require('util').inherits

var util = require('../util')
var verify = require('../verify')


/**
 * @event TxFetcher#error
 * @param {Error} error
 */

/**
 * @callback TxFetcher~errorCallback
 * @param {?Error} error
 */

/**
 * @class TxFetcher
 * @extends external:events.EventEmitter
 * @param {Wallet} wallet
 * @param {Blockchain} blockchain
 */
function TxFetcher(wallet) {
  verify.Wallet(wallet)

  events.EventEmitter.call(this)
  util.SyncMixin.call(this)

  this._wallet = wallet
  this._syncAddresses = new Map()
  this._addEventListeners()
}

inherits(TxFetcher, events.EventEmitter)

/**
 */
TxFetcher.prototype._addEventListeners = function () {
  var self = this

  self._wallet.on('initialize', function () {
    if (self._wallet.getNetwork().isConnected()) {
      self._wallet.getAllAddresses().forEach(self._subscribeAndSync.bind(self))
    }
  })

  self._wallet.getNetwork().on('connect', function () {
    if (self._wallet.isInitialized()) {
      self._wallet.getAllAddresses().forEach(self._subscribeAndSync.bind(self))
    }
  })

  if (self._wallet.getNetwork().isConnected() && self._wallet.isInitialized()) {
    self._wallet.getAllAddresses().forEach(self._subscribeAndSync.bind(self))
  }

  self._wallet.getBlockchain().on('touchAddress', function (address) {
    if (self._wallet.isInitialized() && self._wallet.getAllAddresses().indexOf(address) !== -1) {
      self._sync(address)
    }
  })

  self._wallet.getAddressManager().on('newAddress', function (address) {
    if (self._wallet.getNetwork().isConnected()) {
      self._subscribeAndSync(address.getAddress())
    }
  })
}

/**
 * @param {string} address
 */
TxFetcher.prototype._sync = function (address) {
  var self = this
  if (!self._syncAddresses.has(address)) {
    self._syncAddresses.set(address, {count: 0, promise: Promise.resolve()})
  }

  self._syncAddresses.get(address).count += 1

  self._syncEnter()
  self._syncAddresses.get(address).promise
    .then(function () {
      if (self._syncAddresses.get(address).count === 0) {
        return
      }

      var promise = self._wallet.getBlockchain().getHistory(address)
        .then(function (entries) {
          /** @todo Upgrade 0 to null for unconfirmed */
          entries = entries.map(function (entry) {
            return {txId: entry.txId, height: entry.height || 0}
          })

          return self._wallet.getStateManager().historySync(address, entries)
        })

      self._syncAddresses.set(address, {count: 0, promise: promise})

      return promise
    })
    .then(function () {
      self._syncExit()

    }, function (error) {
      self._syncExit()
      self.emit('error', error)

    })
}

/**
 * @param {string} address
 */
TxFetcher.prototype._subscribeAndSync = function (address) {
  var self = this
  self._wallet.getBlockchain().subscribeAddress(address)
    .then(function () {
      self._sync(address)

    }, function (error) {
      self.emit('error', error)

    })
}


module.exports = TxFetcher
