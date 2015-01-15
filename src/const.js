var _ = require('lodash')


/**
 * @param {Object} obj
 * @return {Object}
 */
function createEnum(obj) {
  var props = _.chain(obj)
    .map(function (value, name) {
      return [name, {enumerable: true, value: value}]
    })
    .zipObject()
    .value()

  return Object.defineProperties({}, props)
}

/**
 * @readonly
 * @enum {number}
 */
var TX_STATUS = createEnum({
  unknown:     0, // Unknown status :-)
  unconfirmed: 1, // As pending only transaction was pushed not from us
  confirmed:   2, // Transaction in blockchain
  invalid:     3, // Double-spend, can't be accepted by network and others cases...
  pending:     4, // Network accepted our transaction but not include in blockchain yet
  dispatch:    5  // Transaction must be sent to network
})

Object.defineProperties(TX_STATUS, {
  valid: {
    enumerable: true,
    value: [
      TX_STATUS.unconfirmed,
      TX_STATUS.confirmed,
      TX_STATUS.pending,
      TX_STATUS.dispatch
    ]
  },
  available: {
    enumerable: true,
    value: [
      TX_STATUS.confirmed,
      TX_STATUS.pending,
      TX_STATUS.dispatch
    ]
  }
})

Object.defineProperties(TX_STATUS, {
  isValid: {
    enumerable: true,
    value: function (status) {
      return TX_STATUS.valid.indexOf(status) !== -1
    }
  },
  isAvailable: {
    enumerable: true,
    value: function (status) {
      return TX_STATUS.available.indexOf(status) !== -1
    }
  }
})


/**
 * @readonly
 * @enum {number}
 */
var HISTORY_ENTRY_TYPE = createEnum({
  send:             1,
  receive:          2,
  payment2yourself: 3,
  issue:            4
})


module.exports.TX_STATUS = TX_STATUS
module.exports.HISTORY_ENTRY_TYPE = HISTORY_ENTRY_TYPE
