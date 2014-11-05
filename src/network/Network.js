var events = require('events')
var inherits = require('util').inherits

var Q = require('q')
var _ = require('lodash')

var bitcoin = require('../bitcoin')
var verify = require('../verify')


/**
 * @event Network#error
 * @type {Error} error
 */

/**
 * @event Network#connect
 */

/**
 * @event Network#disconnect
 */

/**
 * @event Network#newHeight
 */

/**
 * @event Network#touchAddress
 * @type {string} address
 */

/**
 * @class Network
 * @extends events.EventEmitter
 */
function Network() {
  var self = this

  events.EventEmitter.call(self)

  self._isConnected = false
  self.on('connect', function() { self._isConnected = true })
  self.on('disconnect', function() { self._isConnected = false })

  self._currentHeight = -1
  self._currentBlockHash = new Buffer(32).fill(0)

  self._setCurrentHeightRunning = false
  self._setCurrentHeightQueue = []
}

inherits(Network, events.EventEmitter)

/**
 * @return {boolean}
 */
Network.prototype.isConnected = function() {
  return this._isConnected
}

/**
 * @param {number} newHeight
 */
Network.prototype._setCurrentHeight = function(newHeight) {
  verify.number(newHeight)

  var self = this

  var promise = Q()
  if (self._setCurrentHeightRunning === true) {
    self._setCurrentHeightQueue.push(Q.defer())
    promise = _.last(self._setCurrentHeightQueue)
  }
  self._setCurrentHeightRunning = true

  promise.then(function() {
    return Q.ninvoke(self, 'getHeader', newHeight)

  }).then(function(header) {
    header = bitcoin.header2buffer(header)
    self._currentBlockHash = bitcoin.headerHash(header)
    self._currentHeight = newHeight
    self.emit('newHeight')

  }).catch(function(error) {
    self.emit('error', error)

  }).finally(function() {
    self._setCurrentHeightRunning = false
    if (self._setCurrentHeightQueue.length > 0)
      self._setCurrentHeightQueue.pop().resolve()
  })
}

/**
 * @return {number}
 */
Network.prototype.getCurrentHeight = function() {
  return this._currentHeight
}

/**
 * @return {Buffer}
 */
Network.prototype.getCurrentBlockHash = function() {
  return this._currentBlockHash
}

/**
 * @typedef {Object} HeaderObject
 * @property {number} version
 * @property {string} prevBlockHash
 * @property {string} merkleRoot
 * @property {number} timestamp
 * @property {number} bits
 * @property {number} nonce
 */

/**
 * @callback Network~getHeader
 * @param {?Error} error
 * @param {HeaderObject}
 */

/**
 * @abstract
 * @param {number} height
 * @param {Network~getHeader} cb
 */
Network.prototype.getHeader = function() {
  throw new Error('Network.getHeader not implemented')
}

/**
 * @callback Network~getChunk
 * @param {?Error} error
 * @param {string} chunkHex
 */

/**
 * @abstract
 * @param {number} index
 * @param {Network~getChunk} cb
 */
Network.prototype.getChunk = function() {
  throw new Error('Network.getChunk not implemented')
}

/**
 * @callback Network~getTx
 * @param {?Error} error
 * @param {bitcoinjs-lib.Transaction} tx
 */

/**
 * @abstract
 * @param {string} txId
 * @param {Network~getTx} cb
 */
Network.prototype.getTx = function() {
  throw new Error('Network.getTx not implemented')
}

/**
 * @typedef {Object} MerkleObject
 * @property {string[]} merkle
 * @property {number} index
 */

/**
 * @callback Network~getMerkle
 * @param {?Error} error
 * @param {MerkleObject} result
 */

/**
 * @abstract
 * @param {string} txId
 * @param {number} height
 * @param {Network~getMerkle} cb
 */
Network.prototype.getMerkle = function() {
  throw new Error('Network.getMerkle not implemented')
}

/**
 * @callback Network~sendTx
 * @param {?Error} error
 * @param {string} txId
 */

/**
 * @abstract
 * @param {bitcoinjs-lib.Transaction} tx
 * @param {Network~sendTx} cb
 */
Network.prototype.sendTx = function() {
  throw new Error('Network.sendTx not implemented')
}

/**
 * @typedef {Object} HistoryEntry
 * @property {string} txId
 * @property {number} height
 */

/**
 * @callback Network~getHistory
 * @param {?Error} error
 * @param {HistoryEntry[]} entries
 */

/**
 * @abstract
 * @param {string} address
 * @param {Network~getHistory} cb
 */
Network.prototype.getHistory = function() {
  throw new Error('Network.getHistory not implemented')
}

/**
 * @callback Network~subscribeAddress
 * @param {?Error} error
 */

/**
 * @abstract
 * @param {string} address
 * @param {Network~subscribeAddress} cb
 */
Network.prototype.subscribeAddress = function() {
  throw new Error('Network.subscribeAddress not implemented')
}


module.exports = Network
