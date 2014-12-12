var inherits = require('util').inherits

var _ = require('lodash')

var SyncStorage = require('../SyncStorage')
var bitcoin = require('../bitcoin')
var errors = require('../errors')
var verify = require('../verify')


/**
 * @typedef {Object} HistoryStorageRecord
 * @property {string} txId
 * @property {string} tx
 * @property {number} height
 * @property {number} timestamp
 * @property {boolean} isBlockTimestamp
 * @property {{desc: string, value: number}[]} values
 * @property {{desc: string, value: number, script: string}[]} targets
 * @property {number} entryType
 */

/**
 * @param {HistoryStorageRecord[]} records
 * @return {HistoryStorageRecord[]}
 */
function sortHistoryRecords(records) {
  var sortedRecords = _.sortBy(records, function (record) {
    if (record.height === 0) {
      return record.timestamp
    }

    return record.height + record.timestamp / 10000000000
  })

  var recordsIndexByTxId = _.indexBy(sortedRecords, 'txId')
  var resultTxIds = {}
  var result = []
  function sort(record, topRecord) {
    if (resultTxIds[record.txId] === true) {
      return
    }

    bitcoin.Transaction.fromHex(record.tx).ins.forEach(function (input) {
      // not need create new Buffer for input.hash, that not used nowhere
      var inputTxId = Array.prototype.reverse.call(input.hash).toString('hex')
      if (_.isUndefined(recordsIndexByTxId[inputTxId])) {
        return
      }

      if (recordsIndexByTxId[inputTxId].txId === topRecord.txId) {
        throw new Error('Graph is cyclical')
      }

      sort(recordsIndexByTxId[inputTxId], topRecord)
    })

    resultTxIds[record.txId] = true
    result.push(record)
  }
  sortedRecords.forEach(function (record) { sort(record, record) })

  return result
}

/**
 * @class HistoryStorage
 * @extends SyncStorage
 *
 * @param {Object} [opts]
 * @param {number} [opts.saveTimeout=1000] In milliseconds
 */
function HistoryStorage(opts) {
  opts = _.extend({
    saveTimeout: 1000
  }, opts)
  verify.number(opts.saveTimeout)

  SyncStorage.apply(this, Array.prototype.slice.call(arguments))

  this._historyDBKey = this.globalPrefix + 'history'
  this._historyRecords = this.store.get(this._historyDBKey) || []
  this._updateHistoryTxIds()

  if (_.isUndefined(this.store.get(this._historyDBKey + '_version'))) {
    this.store.set(this._historyDBKey + '_version', 1)
  }
}

inherits(HistoryStorage, SyncStorage)

/**
 * @return {HistoryStorageRecord[]}
 */
HistoryStorage.prototype._getRecords = function () {
  return this._historyRecords
}

/**
 * @param {HistoryStorageRecord[]} records
 */
HistoryStorage.prototype._saveRecords = function (records) {
  this._historyRecords = records
  this.store.set(this._historyDBKey, this._historyRecords)
  this._updateHistoryTxIds()
}

/**
 */
HistoryStorage.prototype._updateHistoryTxIds = function () {
  this._historyTxIds = _.chain(this._getRecords())
    .map(function (record, index) { return [record.txId, index] })
    .zipObject()
    .value()
}

/**
 * @param {HistoryStorageRecord} data
 * @throws {UniqueConstraint}
 */
HistoryStorage.prototype.add = function (data) {
  verify.hexString(data.txId)
  verify.hexString(data.tx)
  bitcoin.Transaction.fromHex(data.tx)
  verify.number(data.height)
  verify.number(data.timestamp)
  verify.boolean(data.isBlockTimestamp)
  verify.array(data.values)
  data.values.forEach(function (entry) {
    verify.object(entry)
    verify.string(entry.desc)
    verify.number(entry.value)
  })
  verify.array(data.targets)
  data.targets.forEach(function (entry) {
    verify.object(entry)
    verify.string(entry.desc)
    verify.number(entry.value)
    verify.hexString(entry.script)
  })
  verify.number(data.entryType)

  var records = this._getRecords()
  records.forEach(function (record) {
    if (record.txId === data.txId) {
      throw new errors.UniqueConstraint('HistoryStorage: ' + data.txId)
    }
  })

  records.push({
    txId: data.txId,
    tx: data.tx,
    height: data.height,
    timestamp: data.timestamp,
    isBlockTimestamp: data.isBlockTimestamp,
    values: data.values,
    targets: data.targets,
    entryType: data.entryType
  })

  this._saveRecords(sortHistoryRecords(records))
}

/**
 * @param {string} txId
 * @return {boolean}
 */
HistoryStorage.prototype.has = function (txId) {
  verify.hexString(txId)

  return !_.isUndefined(this._historyTxIds[txId])
}

/**
 * @return {string[]}
 */
HistoryStorage.prototype.getAllTxIds = function () {
  return _.keys(this._historyTxIds)
}

/**
 * @param {string} txId
 * @return {HistoryStorageRecord}
 */
HistoryStorage.prototype.get = function (txId) {
  var index = this._historyTxIds[txId]
  var record = this._historyRecords[index]
  return _.cloneDeep(record)
}

/**
 * @param {string} txId
 * @param {Object} [opts]
 * @param {number} [opts.height]
 * @param {number} [opts.timestamp]
 * @param {boolean} [opts.isBlockTimestamp]
 * @throws {?}
 */
HistoryStorage.prototype.update = function (txId, opts) {
  verify.hexString(txId)
  verify.object(opts)
  if (!_.isUndefined(opts.height)) { verify.number(opts.height) }
  if (!_.isUndefined(opts.timestamp)) { verify.number(opts.timestamp) }
  if (!_.isUndefined(opts.isBlockTimestamp)) { verify.boolean(opts.isBlockTimestamp) }

  var records = this._getRecords().map(function (record) {
    if (record.txId === txId) {
      if (opts.height) { record.height = opts.height }
      if (opts.timestamp) { record.timestamp = opts.timestamp }
      if (opts.isBlockTimestamp) { record.isBlockTimestamp = opts.isBlockTimestamp }
    }

    return record
  })

  this._saveRecords(sortHistoryRecords(records))
}

/**
 * @param {string} txId
 */
HistoryStorage.prototype.remove = function (txId) {
  verify.hexString(txId)
  var records = this._getRecords().filter(function (record) {
    return record.txId !== txId
  })
  this._saveRecords(records)
}


module.exports = HistoryStorage
