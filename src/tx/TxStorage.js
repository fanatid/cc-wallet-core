var inherits = require('util').inherits

var _ = require('lodash')

var SyncStorage = require('../SyncStorage')
var verify = require('../verify')
var txStatus = require('./const').txStatus


/**
 * @typedef {Object} TxStorageRecord
 * @property {string} txId
 * @property {string} rawTx
 * @property {number} status
 * @property {number} [height=null]
 * @property {number} [timestamp=null]
 */

/**
 * @class TxStorage
 * @extends SyncStorage
 */
function TxStorage() {
  SyncStorage.apply(this, Array.prototype.slice.call(arguments))

  this.txDbKey = this.globalPrefix + 'tx'
  this.txRecords = this.store.get(this.txDbKey) || {}

  if (_.isUndefined(this.store.get(this.txDbKey + '_version')))
    this.store.set(this.txDbKey + '_version', '1')

  if (this.store.get(this.txDbKey + '_version') === '1') {
    var records = this._getRecords()
    _.keys(records).forEach(function(txId) {
      records[txId].height = records[txId].blockHeight
      delete records[txId].blockHeight
    })
    this._saveRecords(records)
    this.store.set(this.txDbKey + '_version', '2')
  }
}

inherits(TxStorage, SyncStorage)

/**
 * @return {TxStorageRecord[]}
 */
TxStorage.prototype._getRecords = function() {
  return this.txRecords
}

/**
 * @param {TxStorageRecord[]}
 */
TxStorage.prototype._saveRecords = function(records) {
  this.txRecords = records
  this.store.set(this.txDbKey, records)
}

/**
 * @param {string} txId
 * @param {string} rawTx
 * @param {Object} opts
 * @param {number} opts.status
 * @param {number} opts.height
 * @param {number} opts.timestamp
 * @return {TxStorageRecord}
 * @throws {Error} If txId exists
 */
TxStorage.prototype.addTx = function(txId, rawTx, opts) {
  verify.txId(txId)
  verify.hexString(rawTx)
  verify.object(opts)
  verify.number(opts.status)
  verify.number(opts.height)
  verify.number(opts.timestamp)

  var records = this._getRecords()
  if (!_.isUndefined(records[txId]))
    throw new Error('Same tx already exists')

  records[txId] = {
    txId: txId,
    rawTx: rawTx,
    status: opts.status,
    height: opts.height,
    timestamp: opts.timestamp
  }
  this._saveRecords(records)

  return _.clone(records[txId])
}

/**
 * @param {string} txId
 * @param {Object} opts
 * @param {number} [opts.status]
 * @param {number} [opts.height]
 * @param {number} [opts.timestamp]
 * @return {TxStorageRecord}
 * @throws {Error} If txId exists
 */
TxStorage.prototype.updateTx = function(txId, opts) {
  verify.txId(txId)
  verify.object(opts)
  if (opts.status) verify.number(opts.status)
  if (opts.height) verify.number(opts.height)
  if (opts.timestamp) verify.number(opts.timestamp)

  var records = this._getRecords()
  var record = records[txId]
  if (_.isUndefined(record))
    throw new Error('txId not exists')

  opts = _.extend({
    status: record.status,
    height: record.height,
    timestamp: record.timestamp
  }, opts)

  records[txId] = _.extend(record, {
    status: opts.status,
    height: opts.height,
    timestamp: opts.timestamp
  })
  this._saveRecords(records)

  return _.clone(records[txId])
}

/**
 * @param {string} txId
 * @return {?TxStorageRecord}
 */
TxStorage.prototype.getTx = function(txId) {
  verify.txId(txId)

  var record = this._getRecords()[txId]
  return _.isUndefined(record) ? null : _.clone(record)
}

/**
 * @return {TxStorageRecord[]}
 */
TxStorage.prototype.getAllPendingTxIds = function() {
  var result = []
  _.forEach(this._getRecords(), function(record, txId) {
    if (record.status === txStatus.pending) { result.push(txId) }
  })

  return result
}

/**
 * @param {string} txId
 * @return {?TxStorageRecord}
 */
TxStorage.prototype.removeTx = function(txId) {
  verify.txId(txId)

  var records = this._getRecords()
  var record = records[txId]
  if (_.isUndefined(record))
    return null

  delete records[txId]
  this._saveRecords(records)

  return record
}

/**
 */
TxStorage.prototype.clear = function() {
  this.store.remove(this.txDbKey)
  this.store.remove(this.txDbKey + '_version')
}


module.exports = TxStorage
