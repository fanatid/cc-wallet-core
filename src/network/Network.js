var events = require('events')
var inherits = require('util').inherits

var Q = require('q')
var _ = require('lodash')
var zfill = require('zfill')

var bitcoin = require('../bitcoin')
var errors = require('../errors')
var verify = require('../verify')


/**
 * @event Network#error
 * @param {Error} error
 */

/**
 * @event Network#connect
 */

/**
 * @event Network#disconnect
 */

/**
 * @event Network#newHeight
 * @param {number} height
 */

/**
 * @event Network#touchAddress
 * @param {string} address
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
  self._currentBlockHash = new Buffer(zfill('', 64), 'hex')

  self._setCurrentHeightRunning = false
  self._setCurrentHeightQueue = []
}

inherits(Network, events.EventEmitter)

/**
 * @return {boolean}
 */
Network.prototype.supportVerificationMethods = function() {
  return false
}

/**
 * @return {boolean}
 */
Network.prototype.isConnected = function() {
  return this._isConnected
}

/**
 * @param {number} newHeight
 * @return {Q.Promise}
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

  return promise.then(function() {
    return Q.ninvoke(self, 'getHeader', newHeight)

  }).then(function(header) {
    header = bitcoin.header2buffer(header)
    self._currentBlockHash = bitcoin.headerHash(header)
    self._currentHeight = newHeight
    self.emit('newHeight', newHeight)

  }).catch(function(error) {
    self.emit('error', error)

  }).finally(function() {
    self._setCurrentHeightRunning = false
    if (self._setCurrentHeightQueue.length > 0)
      self._setCurrentHeightQueue.pop().resolve()

  }).done()
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
  throw new errors.NotImplementedError('Network.getHeader')
}

/**
 * @callback Network~getChunk
 * @param {?Error} error
 * @param {string} chunkHex
 */

/**
 * @param {number} index
 * @param {Network~getChunk} cb
 */
Network.prototype.getChunk = function() {
  throw new errors.NotImplementedError('Network.getChunk')
}

/**
 * @callback Network~getTx
 * @param {?Error} error
 * @param {Transaction} tx
 */

/**
 * @abstract
 * @param {string} txId
 * @param {Network~getTx} cb
 */
Network.prototype.getTx = function() {
  throw new errors.NotImplementedError('Network.getTx')
}

/**
 * @typedef {Object} MerkleObject
 * @property {number} height
 * @property {string[]} merkle
 * @property {number} index
 */

/**
 * @callback Network~getMerkle
 * @param {?Error} error
 * @param {MerkleObject} result
 */

/**
 * @param {string} txId
 * @param {number} [height]
 * @param {Network~getMerkle} cb
 */
Network.prototype.getMerkle = function() {
  throw new errors.NotImplementedError('Network.getMerkle')
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
  throw new errors.NotImplementedError('Network.sendTx')
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
  throw new errors.NotImplementedError('Network.getHistory')
}

/**
 * @typedef {Object} UnspentObject
 * @property {string} txId
 * @property {number} outIndex
 * @property {number} value
 * @property {number} height
 */

/**
 * @callback Network~getUnspent
 * @param {?Error} error
 * @param {UnspentObject[]} entries
 */

/**
 * @param {string} address
 * @param {Network~getUnspent} cb
 */
Network.prototype.getUnspent = function() {
  throw new errors.NotImplementedError('Network.getUnspent')
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
  throw new errors.NotImplementedError('Network.subscribeAddress')
}


module.exports = Network
