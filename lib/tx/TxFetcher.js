var events = require('events')
var inherits = require('util').inherits
var Q = require('q')

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
  this._syncAddresses = {}
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

  // event exists only for NetworkSwitcher
  self._wallet.getNetwork().on('switchNetwork', function (newNetwork) {
    if (self._wallet.isInitialized() && newNetwork !== null) {
      self._wallet.getAllAddresses().forEach(self._sync.bind(self))
    }
  })

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

  if (self._wallet.getNetwork().isConnected() && self._wallet.isInitialized()) {
    self._wallet.getAllAddresses().forEach(self._subscribeAndSync.bind(self))
  }
}

/**
 * @param {function} fn
 * @return {function}
 */
function makeSerial(fn) {
  var queue = []

  return function () {
    var ctx = this

    var args = Array.prototype.slice.call(arguments)

    var deferred = Q.defer()

    queue.push(deferred)
    if (queue.length === 1) {
      queue[0].resolve()
    }

    return deferred.promise
      .then(function () { return fn.apply(ctx, args) })
      .finally(function () {
        queue.shift()
        if (queue.length > 0) {
          queue[0].resolve()
        }
      })
  }
}

/**
 * @param {string} address
 */
TxFetcher.prototype._sync = function (address) {
  var self = this
  if (typeof self._syncAddresses[address] === 'undefined') {
    self._syncAddresses[address] = makeSerial(function () {
      return self._wallet.getBlockchain().getHistory(address)
        .then(function (entries) {
          /** @todo Upgrade 0 to null for unconfirmed */
          entries = entries.map(function (entry) {
            return {txId: entry.txId, height: entry.height || 0}
          })

          return self._wallet.getStateManager().historySync(address, entries)
        })
    })
  }

  self._syncEnter()
  self._syncAddresses[address]()
    .finally(self._syncExit.bind(self))
    .done()
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
