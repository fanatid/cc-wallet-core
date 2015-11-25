var enumUtil = require('./enum')

/**
 * @readonly
 * @enum {number}
 */
var TX_STATUS = module.exports.TX_STATUS = enumUtil.create({
  unknown: 0,     // Unknown status :-)
  unconfirmed: 1, // As pending only transaction was pushed not from us
  confirmed: 2,   // Transaction in blockchain
  invalid: 3,     // Double-spend, can't be accepted by network and others cases...
  pending: 4,     // Network accepted our transaction but not include in blockchain yet
  dispatch: 5     // Transaction must be sent to network
})

enumUtil.update(TX_STATUS, {
  valid: [
    TX_STATUS.unconfirmed,
    TX_STATUS.confirmed,
    TX_STATUS.pending,
    TX_STATUS.dispatch
  ],
  available: [
    TX_STATUS.confirmed,
    TX_STATUS.pending,
    TX_STATUS.dispatch
  ]
})

/**
 * @readonly
 * @enum {number}
 */
module.exports.HISTORY_ENTRY_TYPE = enumUtil.create({
  send: 1,
  receive: 2,
  payment2yourself: 3,
  issue: 4
})
