var inherits = require('util').inherits

var _ = require('lodash')
var LRU = require('lru-cache')

var verify = require('../verify')
var Blockchain = require('./Blockchain')


/**
 * @class NaiveBlockchain
 * @extends Blockchain
 * @param {Network} network
 * @param {Object} [opts]
 * @param {number} [opts.headerCacheSize=250]
 * @param {number} [opts.txCacheSize=250]
 */
function NaiveBlockchain(network, opts) {
  verify.Network(network)
  opts = _.extend({headerCacheSize: 250, txCacheSize: 250}, opts)
  verify.number(opts.headerCacheSize)
  verify.number(opts.txCacheSize)

  var self = this
  Blockchain.call(self)

  self._network = network
  self._currentHeight = -1

  self._getHeaderRunning = {}
  self._getTxRunning = {}

  self._headerCache = LRU({max: opts.headerCacheSize})
  this._txCache = LRU({max: opts.txCacheSize})

  self._network.on('newHeight', function (newHeight) {
    self._currentHeight = newHeight
    self.emit('newHeight', newHeight)
  })

  self._network.on('touchAddress', function (address) {
    self.emit('touchAddress', address)
  })
}

inherits(NaiveBlockchain, Blockchain)

/**
 * {@link Blockchain~getCurrentHeight}
 */
NaiveBlockchain.prototype.getCurrentHeight = function () {
  return this._currentHeight
}

/**
 * {@link Blockchain~getBlockTime}
 */
NaiveBlockchain.prototype.getBlockTime = function (height, cb) {
  verify.function(cb)

  var self = this

  var header = self._headerCache.get(height)
  if (!_.isUndefined(header)) {
    return process.nextTick(function () { cb(null, header) })
  }

  if (_.isUndefined(self._getHeaderRunning[height])) {
    self._getHeaderRunning[height] = this._network.getHeader(height).then(function (header) {
      self._headerCache.set(height, header.timestamp)
      return header.timestamp

    }).finally(function () {
      delete self._getHeaderRunning[height]

    })
  }

  self._getHeaderRunning[height]
    .done(function (result) { cb(null, result) }, function (error) { cb(error) })
}

/**
 * {@link Blockchain~getTx}
 */
NaiveBlockchain.prototype.getTx = function (txId, walletState, cb) {
  if (_.isFunction(walletState) && _.isUndefined(cb)) {
    cb = walletState
    walletState = undefined
  }

  verify.txId(txId)
  if (!_.isUndefined(walletState)) { verify.WalletState(walletState) }
  verify.function(cb)

  var self = this

  var tx = self._txCache.get(txId)
  if (!_.isUndefined(tx)) {
    return process.nextTick(function () { cb(null, tx) })
  }

  if (_.isUndefined(self._getTxRunning[txId])) {
    self._getTxRunning[txId] = self._network.getTx(txId, walletState).then(function (tx) {
      self._txCache.set(txId, tx)
      return tx

    }).finally(function () {
      delete self._getTxRunning[txId]

    })
  }

  self._getTxRunning[txId]
    .done(function (tx) { cb(null, tx) }, function (error) { cb(error) })
}

/**
 * {@link Blockchain~sendTx}
 */
NaiveBlockchain.prototype.sendTx = function (tx, cb) {
  this._network.sendTx(tx)
    .done(function (txId) { cb(null, txId) }, function (error) { cb(error) })
}

/**
 * {@link Blockchain~getHistory}
 */
NaiveBlockchain.prototype.getHistory = function (address, cb) {
  this._network.getHistory(address)
    .done(function (entries) { cb(null, entries) }, function (error) { cb(error) })
}

/**
 * {@link Blockchain~subscribeAddress}
 */
NaiveBlockchain.prototype.subscribeAddress = function (address, cb) {
  this._network.subscribeAddress(address)
    .done(function () { cb(null) }, function (error) { cb(error) })
}


module.exports = NaiveBlockchain
