var events = require('events')
var inherits = require('util').inherits


/**
 * @event Blockchain#error
 * @type {Error} error
 */

/**
 * @event Blockchain#newHeight
 */

/**
 * @event Blockchain#touchAddress
 * @type {string} address
 */

/**
 * @class Blockchain
 * @extends events.EventEmitter
 */
function Blockchain() {
  events.EventEmitter.call(this)
}

inherits(Blockchain, events.EventEmitter)

/**
 * @abstract
 * @return {number}
 */
Blockchain.prototype.getCurrentHeight = function() {
  throw new Error('Blockchain.getCurrentHeight not implemented')
}

/**
 * @callback Blockchain~getBlockTime
 * @param {?Error} error
 * @param {number} timestamp
 */

/**
 * @abstract
 * @param {number} height
 * @param {Blockchain~getBlockTime} cb
 */
Blockchain.prototype.getBlockTime = function() {
  throw new Error('Blockchain.getBlockTime not implemented')
}

/**
 * @callback Blockchain~getTx
 * @param {?Error} error
 * @param {Transaction} tx
 */

/**
 * @abstract
 * @param {string} txId
 * @param {Blockchain~getTx} cb
 */
Blockchain.prototype.getTx = function() {
  throw new Error('Blockchain.getTx not implemented')
}

/**
 * @callback Blockchain~sendTx
 * @param {?Error} error
 * @param {string} txId
 */

/**
 * @abstract
 * @param {Transaction} tx
 * @param {Blockchain~sendTx} cb
 */
Blockchain.prototype.sendTx = function() {
  throw new Error('Blockchain.sendTx not implemented')
}

/**
 * @typedef {Object} HistoryEntry
 * @property {string} txId
 * @property {number} height Zero for unconfirmed transactions
 */

/**
 * @callback Blockchain~getHistory
 * @param {?Error} error
 * @param {HistoryEntry[]} entries
 */

/**
 * @abstract
 * @param {string} address
 * @param {Blockchain~getHistory} cb
 */
Blockchain.prototype.getHistory = function() {
  throw new Error('Blockchain.getHistory not implemented')
}

/**
 * @callback Blockchain~subscribeAddress
 * @param {?Error} error
 */

/**
 * @abstract
 * @param {string} address
 * @param {Blockchain~subscribeAddress} cb
 */
Blockchain.prototype.subscribeAddress = function() {
  throw new Error('Blockchain.subscribeAddress not implemented')
}

/**
 * Clear VerifiedBlockchainStorage in VerifiedBlockchain
 */
Blockchain.prototype.clear = function() {}


module.exports = Blockchain
