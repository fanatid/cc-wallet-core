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
 * @extends external:events.EventEmitter
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
 * @callback Blockchain~getBlockTimeCallback
 * @param {?Error} error
 * @param {number} timestamp
 */

/**
 * @abstract
 * @param {number} height
 * @param {Blockchain~getBlockTimeCallback} cb
 */
Blockchain.prototype.getBlockTime = function () {
  throw new errors.NotImplementedError('Blockchain.getBlockTime')
}

/**
 * @callback Blockchain~getTxCallback
 * @param {?Error} error
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 */

/**
 * @abstract
 * @param {string} txId
 * @param {WalletState} [walletState]
 * @param {Blockchain~getTxCallback} cb
 */
Blockchain.prototype.getTx = function () {
  throw new errors.NotImplementedError('Blockchain.getTx')
}

/**
 * @return {Blockchain~getTx}
 */
Blockchain.prototype.getTxFn = function () {
  return this.getTx.bind(this)
}

/**
 * @callback Blockchain~sendTxCallback
 * @param {?Error} error
 * @param {string} txId
 */

/**
 * @abstract
 * @param {Transaction} tx
 * @param {Blockchain~sendTxCallback} cb
 */
Blockchain.prototype.sendTx = function () {
  throw new errors.NotImplementedError('Blockchain.sendTx')
}

/**
 * @callback Blockchain~getHistoryCallback
 * @param {?Error} error
 * @param {Array.<{txId: string, height: number}>} entries
 */

/**
 * @abstract
 * @param {string} address
 * @param {Blockchain~getHistoryCallback} cb
 */
Blockchain.prototype.getHistory = function () {
  throw new errors.NotImplementedError('Blockchain.getHistory')
}

/**
 * @callback Blockchain~subscribeAddressCallback
 * @param {?Error} error
 */

/**
 * @abstract
 * @param {string} address
 * @param {Blockchain~subscribeAddressCallback} cb
 */
Blockchain.prototype.subscribeAddress = function () {
  throw new errors.NotImplementedError('Blockchain.subscribeAddress')
}


module.exports = Blockchain
