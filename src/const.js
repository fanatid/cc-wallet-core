/**
 * @readonly
 * @enum {number}
 */
var txStatus = {
  unknown: 0,     // Unknown status :-)
  unconfirmed: 1, // As pending only transaction was pushed not from us
  confirmed: 2,   // Transaction in blockchain
  invalid: 3,     // Double-spend, can't be accepted by network and others cases...
  pending: 4,     // Network accepted our transaction but not include in blockchain yet
  dispatch: 5     // Transaction must be sent to network
}

txStatus.valid = [txStatus.unconfirmed, txStatus.confirmed, txStatus.pending, txStatus.dispatch]
/**
 * @param {number} status
 * @return {boolean}
 */
txStatus.isValid = function(status) {
  return txStatus.valid.indexOf(status) !== -1
}

txStatus.available = [txStatus.confirmed, txStatus.pending, txStatus.dispatch]
/**
 * @param {number} status
 * @return {boolean}
 */
txStatus.isAvailable = function(status) {
  return txStatus.available.indexOf(status) !== -1
}


module.exports.txStatus = txStatus
