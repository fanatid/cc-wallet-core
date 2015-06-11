var _ = require('lodash')
var Promise = require('bluebird')

/**
 * @param {Object} obj
 * @param {function} obj.getTx
 * @return {function}
 */
module.exports.createGetTxFn = function (obj) {
  return function getTxFn (txid, cb) {
    Promise.try(function () {
      return obj.getTx(txid)
    })
    .asCallback(cb)
    .done(_.noop, _.noop)
  }
}
