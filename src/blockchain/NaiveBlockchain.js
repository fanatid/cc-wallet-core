var inherits = require('util').inherits

var Q = require('q')

var verify = require('../verify')
var Blockchain = require('./Blockchain')


/**
 * @class NaiveBlockchain
 * @extends Blockchain
 * @param {Wallet} wallet
 */
function NaiveBlockchain(wallet) {
  verify.Wallet(wallet)

  var self = this
  Blockchain.call(self)

  self._wallet = wallet
  self._currentHeight = -1

  self._wallet.getNetwork().on('newHeight', function() {
    self._currentHeight = self._wallet.getNetwork().getCurrentHeight()
    self.emit('newHeight')
  })

  self._wallet.getNetwork().on('touchAddress', function(address) {
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
  verify.number(height)
  verify.function(cb)

  Q.ninvoke(this._wallet.getNetwork(), 'getHeader', height)
    .done(function(header) { cb(null, header.timestamp) }, function(error) { cb(error) })
}

/**
 * {@link Blockchain~getTx}
 */
NaiveBlockchain.prototype.getTx = function(txId, cb) {
  this._wallet.getNetwork().getTx(txId, cb)
}

/**
 * {@link Blockchain~sendTx}
 */
NaiveBlockchain.prototype.sendTx = function(tx, cb) {
  this._wallet.getNetwork().sendTx(tx, cb)
}

/**
 * {@link Blockchain~getHistory}
 */
NaiveBlockchain.prototype.getHistory = function(address, cb) {
  this._wallet.getNetwork().getHistory(address, cb)
}

/**
 * {@link Blockchain~subscribeAddress}
 */
NaiveBlockchain.prototype.subscribeAddress = function(address, cb) {
  this._wallet.getNetwork().subscribeAddress(address, cb)
}


module.exports = NaiveBlockchain
