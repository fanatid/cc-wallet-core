var inherits = require('util').inherits

var _ = require('lodash')
var delayed = require('delayed')

var SyncStorage = require('../SyncStorage')
var verify = require('../verify')


/**
 * @todo Add shrotcut names for save storage's size
 */

/**
 * @typedef {Object} TxStorageRecord
 * @property {string} rawTx
 * @property {number} status
 * @property {number} height
 * @property {number} timestamp
 * @property {boolean} isBlockTimestamp
 * @property {string[]} tAddresses
 * @property {string[]} rAddresses
 */

/**
 * @class TxStorage
 * @extends SyncStorage
 *
 * @param {Object} [opts]
 * @param {number} [opts.saveTimeout=1000] In milliseconds
 */
function TxStorage(opts) {
  opts = _.extend({
    saveTimeout: 1000
  }, opts)
  verify.number(opts.saveTimeout)

  SyncStorage.apply(this, Array.prototype.slice.call(arguments))

  this._save2store = delayed.debounce(this._save2store, opts.saveTimeout, this)

  this.txDbKey = this.globalPrefix + 'tx'
  this.txRecords = this.store.get(this.txDbKey) || {}

  if (_.isUndefined(this.store.get(this.txDbKey + '_version'))) {
    this.store.set(this.txDbKey + '_version', '1')
  }

/*
  if (this.store.get(this.txDbKey + '_version') === '1') {
    var records = this._getRecords()
    _.keys(records).forEach(function(txId) {
      records[txId].height = records[txId].blockHeight
      delete records[txId].blockHeight
    })
    this._saveRecords(records)
    this.store.set(this.txDbKey + '_version', '2')
  }

  if (this.store.get(this.txDbKey + '_version') === '2') {
    this._saveRecords([])
    this.store.set(this.txDbKey + '_version', '3')
  }
*/

  if (['1', '2', '3'].indexOf(this.store.get(this.txDbKey + '_version')) !== -1) {
    this._saveRecords({})
    this.store.set(this.txDbKey + '_version', 4)
  }

  if (this.store.get(this.txDbKey + '_version') === 4) {
    // Drop, because timestamp was invalid
    this._saveRecords({})
    this.store.set(this.txDbKey + '_version', 5)
  }

  if (this.store.get(this.txDbKey + '_version') === 5) {
    var records = this._getRecords()
    _.forEach(records, function (record) { record.isBlockTimestamp = true })
    this._saveRecords(records)
    this.store.set(this.txDbKey + '_version', 6)
  }
}

inherits(TxStorage, SyncStorage)

/**
 * @return {TxStorageRecord[]}
 */
TxStorage.prototype._getRecords = function () {
  return this.txRecords
}

/**
 * @param {TxStorageRecord[]} records
 */
TxStorage.prototype._saveRecords = function (records) {
  this.txRecords = records
  this._save2store()
}

/**
 */
TxStorage.prototype._save2store = function () {
  this.store.set(this.txDbKey, this.txRecords)
}

/**
 * @param {string} txId
 * @param {string} rawTx
 * @param {Object} opts
 * @param {number} opts.status
 * @param {number} opts.height
 * @param {number} opts.timestamp
 * @param {boolean} [opts.isBlockTimestamp=false]
 * @param {string} opts.tAddresses
 * @return {TxStorageRecord}
 * @throws {Error} If txId exists
 */
TxStorage.prototype.add = function (txId, rawTx, opts) {
  verify.txId(txId)
  verify.hexString(rawTx)
  verify.object(opts)
  verify.number(opts.status)
  verify.number(opts.height)
  verify.number(opts.timestamp)
  if (!_.isUndefined(opts.isBlockTimestamp)) { verify.boolean(opts.isBlockTimestamp) }
  verify.array(opts.tAddresses)
  opts.tAddresses.forEach(verify.string)

  var records = this._getRecords()
  if (!_.isUndefined(records[txId])) {
    throw new Error('Same tx already exists')
  }

  records[txId] = {
    rawTx: rawTx,
    status: opts.status,
    height: opts.height,
    timestamp: opts.timestamp,
    isBlockTimestamp: opts.isBlockTimestamp || false,
    tAddresses: _.sortBy(opts.tAddresses)
  }
  this._saveRecords(records)

  return _.cloneDeep(records[txId])
}

/**
 * @param {string} txId
 * @param {Object} opts
 * @param {number} [opts.status]
 * @param {number} [opts.height]
 * @param {number} [opts.timestamp]
 * @param {string[]} [opts.tAddresses]
 * @return {TxStorageRecord}
 * @throws {Error} If txId exists
 */
TxStorage.prototype.update = function (txId, opts) {
  verify.txId(txId)
  verify.object(opts)
  if (opts.status) { verify.number(opts.status) }
  if (opts.height) { verify.number(opts.height) }
  if (opts.timestamp) { verify.number(opts.timestamp) }
  if (opts.tAddresses) { verify.array(opts.tAddresses) }
  if (opts.tAddresses) { opts.tAddresses.forEach(verify.string) }

  var records = this._getRecords()
  var record = records[txId]
  if (_.isUndefined(record)) {
    throw new Error('txId not exists')
  }

  opts = _.extend({
    status: record.status,
    height: record.height,
    timestamp: record.timestamp,
    tAddresses: record.tAddresses
  }, opts)

  records[txId] = _.extend(record, {
    status: opts.status,
    height: opts.height,
    timestamp: opts.timestamp,
    tAddresses: opts.tAddresses,
  })
  record.tAddresses = _.sortBy(record.tAddresses)
  record.rAddresses = _.sortBy(_.intersection(record.rAddresses, record.tAddresses))
  this._saveRecords(records)

  return _.cloneDeep(records[txId])
}

/**
 * @param {string} txId
 * @return {?TxStorageRecord}
 */
TxStorage.prototype.get = function (txId) {
  verify.txId(txId)

  var record = this._getRecords()[txId]
  return _.isUndefined(record) ? null : _.cloneDeep(record)
}

/**
 * @return {string[]}
 */
TxStorage.prototype.getAllTxIds = function () {
  return _.keys(this._getRecords())
}

/**
 * @param {string} txId
 * @param {string} address
 * @return {?TxStorageRecord}
 */
TxStorage.prototype.removeTouchedAddress = function (txId, address) {
  verify.txId(txId)
  verify.string(address)

  var records = this._getRecords()
  var record = records[txId]
  if (_.isUndefined(record)) {
    return null
  }

  record.rAddresses = _.chain(record.rAddresses)
    .union([address])
    .intersection(record.tAddresses)
    .sortBy()
    .value()
  this._saveRecords(records)

  return _.cloneDeep(record)
}

/**
 * @param {string} txId
 * @return {?TxStorageRecord}
 */
TxStorage.prototype.remove = function (txId) {
  verify.txId(txId)

  var records = this._getRecords()
  var record = records[txId]
  if (_.isUndefined(record)) {
    return null
  }

  delete records[txId]
  this._saveRecords(records)

  return record
}

/**
 */
TxStorage.prototype.clear = function () {
  this.store.remove(this.txDbKey)
  this.store.remove(this.txDbKey + '_version')
}


module.exports = TxStorage
