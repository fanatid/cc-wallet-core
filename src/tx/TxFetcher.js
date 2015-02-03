var events = require('events')
var inherits = require('util').inherits

var Q = require('q')

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

  var self = this
  events.EventEmitter.call(self)

  self._subscribedAddresses = {}

  self._wallet = wallet

  self._wallet.getBlockchain().on('touchAddress', function (address) {
    if (typeof self._subscribedAddresses[address] === 'undefined') {
      return
    }

    self._subscribedAddresses[address].count += 1
    self.historySync(address, function (error) {
      if (error) { self.emit('error', error) }
    })
  })
}

inherits(TxFetcher, events.EventEmitter)

/**
 * @param {string} address
 * @param {TxFetcher~errorCallback} cb
 */
TxFetcher.prototype.historySync = function (address, cb) {
  verify.string(address)
  verify.function(cb)

  var self = this

  self._subscribedAddresses[address].promise
    .then(function () {
      if (self._subscribedAddresses[address].count === 0) {
        return
      }

      self._subscribedAddresses[address].count = 0

      var deferred = Q.defer()
      self._subscribedAddresses[address].promise = deferred.promise

      function onFulfilled() {
        deferred.resolve()
        cb(null)
      }

      function onRejected(error) {
        deferred.resolve()
        cb(error)
      }

      self._wallet.getBlockchain().getHistory(address)
        .then(function (entries) {
          /** @todo Upgrade 0 to null for unconfirmed */
          entries = entries.map(function (entry) {
            return {txId: entry.txId, height: entry.height || 0}
          })

          return self._wallet.getStateManager().historySync(address, entries)
        })
        .then(onFulfilled, onRejected)
    })
}

/**
 * @param {string} address
 * @param {TxFetcher~errorCallback} cb
 */
TxFetcher.prototype.subscribeAndSyncAddress = function (address, cb) {
  verify.string(address)
  verify.function(cb)

  var self = this
  if (typeof self._subscribedAddresses[address] !== 'undefined') {
    return cb(null)
  }

  self._wallet.getBlockchain().subscribeAddress(address)
    .then(function () {
      self._subscribedAddresses[address] = {count: 1, promise: Q()}
      return Q.ninvoke(self, 'historySync', address)
    })
    .then(function () { cb(null) }, function (error) { cb(error) })
}

/**
 * @param {string[]} addresses
 * @param {TxFetcher~errorCallback} cb
 */
TxFetcher.prototype.subscribeAndSyncAllAddresses = function (addresses, cb) {
  verify.array(addresses)
  addresses.forEach(verify.string)
  verify.function(cb)

  var self = this
  var promises = addresses.map(function (address) {
    return Q.ninvoke(self, 'subscribeAndSyncAddress', address)
  })

  Q.all(promises).done(function () { cb(null) }, function (error) { cb(error) })
}


module.exports = TxFetcher
