var events = require('events')
var inherits = require('util').inherits

var _ = require('lodash')
var LRU = require('lru-cache')

var verify = require('../verify')


/**
 * @event Network#error
 * @type {Error} error
 *

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

  self.setCurrentHeight(-1, false)

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
 * @param {boolean} [broadcast=true]
 */
Network.prototype.setCurrentHeight = function(newHeight, broadcast) {
  verify.number(newHeight)
  if (_.isUndefined(broadcast)) broadcast = true
  verify.boolean(broadcast)

  this._currentHeight = newHeight
  if (broadcast === true)
    this.emit('newHeight')
}

/**
 * @return {number}
 */
Network.prototype.getCurrentHeight = function() {
  return this._currentHeight
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
