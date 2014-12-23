var events = require('events')
var inherits = require('util').inherits

var errors = require('../errors')


/**
 * @event Blockchain#error
 * @param {Error} error
 */

/**
 * @event Blockchain#newHeight
 * @param {number} height
 */

/**
 * @event Blockchain#touchAddress
 * @param {string} address
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
Blockchain.prototype.getCurrentHeight = function () {
  throw new errors.NotImplementedError('Blockchain.getCurrentHeight')
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
Blockchain.prototype.getBlockTime = function () {
  throw new errors.NotImplementedError('Blockchain.getBlockTime')
}

/**
 * @callback Blockchain~getTx
 * @param {?Error} error
 * @param {Transaction} tx
 */

/**
 * @abstract
 * @param {string} txId
 * @param {WalletState} [walletState]
 * @param {Blockchain~getTx} cb
 */
Blockchain.prototype.getTx = function () {
  throw new errors.NotImplementedError('Blockchain.getTx')
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
Blockchain.prototype.sendTx = function () {
  throw new errors.NotImplementedError('Blockchain.sendTx')
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
Blockchain.prototype.getHistory = function () {
  throw new errors.NotImplementedError('Blockchain.getHistory')
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
Blockchain.prototype.subscribeAddress = function () {
  throw new errors.NotImplementedError('Blockchain.subscribeAddress')
}


module.exports = Blockchain
