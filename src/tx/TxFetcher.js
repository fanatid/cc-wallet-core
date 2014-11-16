var events = require('events')
var inherits = require('util').inherits

var _ = require('lodash')
var Q = require('q')

var verify = require('../verify')


/**
 * @event TxFetcher#error
 * @type {Error} error
 */

/**
 * @callback TxFetcher~errorCallback
 * @param {?Error} error
 */

/**
 * @class TxFetcher
 * @extends events.EventEmitter
 * @param {TxDb} txdb
 * @param {Blockchain} blockchain
 */
function TxFetcher(txdb, blockchain) {
  verify.TxDb(txdb)
  verify.Blockchain(blockchain)

  var self = this
  events.EventEmitter.call(self)

  self._subscribedAddresses = {}

  self._txdb = txdb
  self._blockchain = blockchain

  self._blockchain.on('touchAddress', function(address) {
    if (_.isUndefined(self._subscribedAddresses[address]))
      return

    self.historySync(address, function(error) {
      if (error)
        self.emit('error', error)
    })
  })
}

inherits(TxFetcher, events.EventEmitter)

/**
 * @param {string} address
 * @param {TxFetcher~errorCallback} cb
 */
TxFetcher.prototype.historySync = function(address, cb) {
  verify.string(address)
  verify.function(cb)

  var self = this
  Q.ninvoke(self._blockchain, 'getHistory', address).then(function(entries) {
    return Q.ninvoke(self._txdb, 'historySync', address, entries)

  }).done(function() { cb(null) }, function(error) { cb(error) })
}

/**
 * @param {string} address
 * @param {TxFetcher~errorCallback} cb
 */
TxFetcher.prototype.subscribeAndSyncAddress = function(address, cb) {
  verify.string(address)
  verify.function(cb)

  var self = this
  if (!_.isUndefined(self._subscribedAddresses[address]))
    return process.nextTick(function() { cb(null) })

  Q.ninvoke(self._blockchain, 'subscribeAddress', address).then(function() {
    self._subscribedAddresses[address] = true
    return Q.ninvoke(self, 'historySync', address)

  }).done(function() { cb(null) }, function(error) { cb(error) })
}

/**
 * @param {string[]} addresses
 * @param {TxFetcher~errorCallback} cb
 */
TxFetcher.prototype.subscribeAndSyncAllAddresses = function(addresses, cb) {
  verify.array(addresses)
  addresses.forEach(verify.string)
  verify.function(cb)

  var self = this
  var promises = addresses.map(function(address) {
    return Q.ninvoke(self, 'subscribeAndSyncAddress', address)
  })

  Q.all(promises).done(function() { cb(null) }, function(error) { cb(error) })
}


module.exports = TxFetcher
