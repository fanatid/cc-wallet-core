var inherits = require('util').inherits

var _ = require('lodash')

var SyncStorage = require('../SyncStorage')
var verify = require('../verify')


/**
 * @typedef {Object} TxStorageRecord
 * @property {string} txId
 * @property {string} rawTx
 * @property {number} status
 * @property {number} [blockHeight=null]
 * @property {number} [timestamp=null]
 */

/**
 * @class TxStorage
 * @extends SyncStorage
 */
function TxStorage() {
  SyncStorage.apply(this, Array.prototype.slice.call(arguments))

  this.dbKey = this.globalPrefix + 'tx'

  //if (!_.isObject(this.store.get(this.dbKey)))
  //  this.store.set(this.dbKey, {})
}

inherits(TxStorage, SyncStorage)

/**
 * @param {string} txId
 * @param {string} rawTx
 * @param {Object} opts
 * @param {number} opts.status
 * @param {number} opts.blockHeight
 * @param {number} opts.timestamp
 * @return {TxStorageRecord}
 * @throws {Error} If txId exists
 */
TxStorage.prototype.addTx = function(txId, rawTx, opts) {
  verify.txId(txId)
  verify.hexString(rawTx)
  verify.object(opts)
  verify.number(opts.status)
  verify.number(opts.blockHeight)
  verify.number(opts.timestamp)

  var records = this.getAll()
  if (!_.isUndefined(records[txId]))
    throw new Error('Same tx already exists')

  var newObj = {
    txId: txId,
    rawTx: rawTx,
    status: opts.status,
    blockHeight: opts.blockHeight,
    timestamp: opts.timestamp
  }

  records[txId] = newObj
  this.store.set(this.dbKey, records)

  return newObj
}

/**
 * @param {string} txId
 * @param {Object} opts
 * @param {number} [opts.status]
 * @param {number} [opts.blockHeight]
 * @param {number} [opts.timestamp]
 * @return {TxStorageRecord}
 * @throws {Error} If txId exists
 */
TxStorage.prototype.updateTx = function(txId, opts) {
  verify.txId(txId)
  verify.object(opts)
  if (opts.status) verify.number(opts.status)
  if (opts.blockHeight) verify.number(opts.blockHeight)
  if (opts.timestamp) verify.number(opts.timestamp)

  var records = this.getAll()
  var record = records[txId]
  if (_.isUndefined(record))
    throw new Error('txId not exists')

  opts = _.extend({
    status: record.status,
    blockHeight: record.blockHeight,
    timestamp: record.timestamp
  }, opts)

  records[txId] = _.extend(record, {
    status: opts.status,
    blockHeight: opts.blockHeight,
    timestamp: opts.timestamp
  })

  this.store.set(this.dbKey, records)
}

/**
 * @param {string} txId
 * @return {?TxStorageRecord}
 */
TxStorage.prototype.getTx = function(txId) {
  verify.txId(txId)

  var record = this.getAll()[txId] || null
  return record
}

/**
 * @return {TxStorageRecord[]}
 */
TxStorage.prototype.getAll = function() {
  var records = this.store.get(this.dbKey) || {}
  return records
}

/**
 * @param {string} txId
 * @return {?Transaction}
 */
TxStorage.prototype.removeTx = function(txId) {
  verify.txId(txId)

  var records = this.getAll()
  var record = records[txId]
  if (_.isUndefined(record))
    return null

  delete records[txId]
  this.store.set(this.dbKey, records)

  return record
}

/**
 */
TxStorage.prototype.clear = function() {
  this.store.remove(this.dbKey)
}


module.exports = TxStorage
