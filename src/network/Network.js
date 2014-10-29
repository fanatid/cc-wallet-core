var events = require('events')
var inherits = require('util').inherits

var Q = require('q')
var _ = require('lodash')
var LRU = require('lru-cache')

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
 * @param {Object} opts
 * @param {number} [opts.txCacheSize=1000]
 */
function Network(opts) {
  opts = _.extend({ txCacheSize: 1000 }, opts)
  verify.object(opts)
  verify.number(opts.txCacheSize)

  var self = this

  events.EventEmitter.call(self)

  self._isConnected = false
  self.on('connect', function() { self._isConnected = true })
  self.on('disconnect', function() { self._isConnected = false })

  self._currentHeight = -1
  self._currentBlockHash = new Buffer(32).fill(0)

  self.txCache = LRU({ max: opts.txCacheSize })
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
Network.prototype.setCurrentHeight = function(newHeight) {
  verify.number(newHeight)

  var self = this

  // need synchronization?
  Q.ninvoke(self, 'getHeader', newHeight).then(function(header) {
    header = bitcoin.header2buffer(header)
    self._currentBlockHash = bitcoin.headerHash(header)
    self._currentHeight = newHeight
    self.emit('newHeight')

  }).catch(function(error) { self.emit('error', error) })
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
 * @callback Network~subscribeAddress
 * @param {?Error} error
 */

/**
 * @param {string} address
 * @param {Network~subscribeAddress} cb
 */
Network.prototype.subscribeAddress = function() {}

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
 * @param {number} height
 * @param {Network~getHeader} cb
 */
Network.prototype.getHeader = function() {}

/**
 * @callback Network~getChunk
 * @param {?Error} error
 * @param {string} chunkHex
 */

/**
 * @param {number} index
 * @param {Network~getChunk} cb
 */
Network.prototype.getChunk = function() {}

/**
 * @callback Network~getTx
 * @param {?Error} error
 * @param {bitcoinjs-lib.Transaction} tx
 */

/**
 * @param {string} txId
 * @param {Network~getTx} cb
 */
Network.prototype.getTx = function() {}

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
 * @param {string} txId
 * @param {number} height
 * @param {Network~getMerkle} cb
 */
Network.prototype.getMerkle = function() {}

/**
 * @callback Network~sendTx
 * @param {?Error} error
 * @param {string} txId
 */

/**
 * @param {bitcoinjs-lib.Transaction} tx
 * @param {Network~sendTx} cb
 */
Network.prototype.sendTx = function() {}

/**
 * @typedef {Object} HistoryObject
 * @property {string} txId
 * @property {number} height
 */

/**
 * @callback Network~getHistory
 * @param {?Error} error
 * @param {HistoryObject[]} entries
 */

/**
 * @param {string} address
 * @param {Network~getHistory} cb
 */
Network.prototype.getHistory = function() {}


module.exports = Network
