var events = require('events')
var inherits = require('util').inherits

var _ = require('lodash')
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
    if (_.isUndefined(self._subscribedAddresses[address])) { return }

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

  var wallet = this._wallet
  Q.ninvoke(wallet.getBlockchain(), 'getHistory', address).then(function (entries) {
    return wallet.getStateManager().historySync(address, entries)

  }).done(function () { cb(null) }, function (error) { cb(error) })
}

/**
 * @param {string} address
 * @param {TxFetcher~errorCallback} cb
 */
TxFetcher.prototype.subscribeAndSyncAddress = function (address, cb) {
  verify.string(address)
  verify.function(cb)

  var self = this
  if (!_.isUndefined(self._subscribedAddresses[address])) {
    return cb(null)
  }

  Q.ninvoke(self._wallet.getBlockchain(), 'subscribeAddress', address).then(function () {
    self._subscribedAddresses[address] = true
    return Q.ninvoke(self, 'historySync', address)

  }).done(function () { cb(null) }, function (error) { cb(error) })
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
