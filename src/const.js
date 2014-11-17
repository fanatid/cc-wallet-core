/**
 * @readonly
 * @enum {number}
 */
var txStatus = {
  unknown: 0,
  unconfirmed: 1,
  confirmed: 2,
  invalid: 3,
  pending: 4
}

txStatus.valid = [txStatus.unconfirmed, txStatus.confirmed, txStatus.pending]
/**
 * @param {number} status
 * @return {boolean}
 */
txStatus.isValid = function(status) {
  return txStatus.valid.indexOf(status) !== -1
}

txStatus.available = [txStatus.confirmed, txStatus.pending]
/**
 * @param {number} status
 * @return {boolean}
 */
txStatus.isAvailable = function(status) {
  return txStatus.available.indexOf(status) !== -1
}


module.exports.txStatus = txStatus
