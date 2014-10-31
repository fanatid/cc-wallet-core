var inherits = require('util').inherits

var Q = require('q')

var verify = require('../verify')
var Blockchain = require('./Blockchain')


/**
 * @class NaiveBlockchain
 * @extends Blockchain
 * @param {Network} network
 */
function NaiveBlockchain(network) {
  verify.Network(network)

  var self = this
  Blockchain.call(self)

  self._network = network
  self._currentHeight = -1

  self._network.on('newHeight', function() {
    self._currentHeight = self._network.getCurrentHeight()
    self.emit('newHeight')
  })

  self._network.on('touchAddress', function(address) {
    self.emit('touchAddress', address)
  })
}

inherits(NaiveBlockchain, Blockchain)

/**
 * {@link Blockchain~getCurrentHeight}
 */
NaiveBlockchain.prototype.getCurrentHeight = function() {
  return this._currentHeight
}

/**
 * {@link Blockchain~getBlockTime}
 */
NaiveBlockchain.prototype.getBlockTime = function(height, cb) {
  verify.function(cb)

  Q.ninvoke(this._network, 'getHeader', height)
    .done(function(header) { cb(null, header.timestamp) }, function(error) { cb(error) })
}

/**
 * {@link Blockchain~getTx}
 */
NaiveBlockchain.prototype.getTx = function(txId, cb) {
  this._network.getTx(txId, cb)
}

/**
 * {@link Blockchain~sendTx}
 */
NaiveBlockchain.prototype.sendTx = function(tx, cb) {
  this._network.sendTx(tx, cb)
}

/**
 * {@link Blockchain~getHistory}
 */
NaiveBlockchain.prototype.getHistory = function(address, cb) {
  this._network.getHistory(address, cb)
}

/**
 * {@link Blockchain~subscribeAddress}
 */
NaiveBlockchain.prototype.subscribeAddress = function(address, cb) {
  this._network.subscribeAddress(address, cb)
}


module.exports = NaiveBlockchain
