var inherits = require('util').inherits

var _ = require('lodash')

var SyncStorage = require('../SyncStorage')
var verify = require('../verify')


/**
 * @typedef {Object} CoinStorageRecord
 * @property {string} txId
 * @property {number} outIndex
 * @property {number} value
 * @property {string} script
 * @property {string[]} addresses
 */

/**
 * @class CoinStorage
 * @extends SyncStorage
 */
function CoinStorage() {
  SyncStorage.apply(this, Array.prototype.slice.call(arguments))

  this.coinsDbKey = this.globalPrefix + 'coins'
  this.coinsRecords = this.store.get(this.coinsDbKey) || []
  this.spendsDbKey = this.globalPrefix + 'spends'
  this.spendsRecords = this.store.get(this.spendsDbKey) || {}

  if (_.isUndefined(this.store.get(this.coinsDbKey + '_version')))
    this.store.set(this.coinsDbKey + '_version', '1')

  if (this.store.get(this.coinsDbKey + '_version') === '1') {
    var records = []
    this._getCoinRecords().forEach(function(record) {
      var exists = records.some(function(obj) {
        if (obj.txId === record.txId && obj.outIndex === record.outIndex)
          return obj.addresses.push(record.address)
      })
      if (!exists)
        records.push({
          txId: record.txId,
          outIndex: record.outIndex,
          value: record.value,
          script: record.script,
          addresses: [record.address]
        })
    })
    this._saveCoinRecords(records)
    this.store.set(this.coinsDbKey + '_version', '2')
  }

  if (_.isUndefined(this.store.get(this.spendsDbKey + '_version')))
    this.store.set(this.spendsDbKey + '_version', '1')
}

inherits(CoinStorage, SyncStorage)

/**
 * @return {CoinStorageRecord[]}
 */
CoinStorage.prototype._getCoinRecords = function() {
  return this.coinsRecords
}

/**
 * @param {CoinStorageRecord[]}
 */
CoinStorage.prototype._saveCoinRecords = function(records) {
  this.store.set(this.coinsDbKey, records)
  this.coinsRecords = records
}

/**
 * @param {string} txId
 * @param {number} outIndex
 * @param {Object} opts
 * @param {number} opts.value
 * @param {string} opts.script
 * @param {string[]} opts.addresses
 * @throws {Error} If coin already exists
 */
CoinStorage.prototype.addCoin = function(txId, outIndex, opts) {
  verify.txId(txId)
  verify.number(outIndex)
  verify.object(opts)
  verify.number(opts.value)
  verify.hexString(opts.script)
  verify.array(opts.addresses)
  opts.addresses.forEach(verify.string)

  var records = this._getCoinRecords()
  records.forEach(function(record) {
    if (record.txId === txId && record.outIndex === outIndex)
      throw new Error('Same coin already exists')
  })

  records.push({
    txId: txId,
    outIndex: outIndex,
    value: opts.value,
    script: opts.script,
    addresses: opts.addresses
  })

  this._saveCoinRecords(records)
}

/**
 * @param {string} address
 * @return {CoinStorageRecord[]}
 */
CoinStorage.prototype.getCoinsForAddress = function(address) {
  verify.string(address)

  var records = this._getCoinRecords().filter(function(record) {
    return record.addresses.indexOf(address) !== -1
  })

  return _.cloneDeep(records)
}

/**
 * @param {string} txId
 * @param {number} outIndex
 * @return {?CoinStorageRecord}
 */
CoinStorage.prototype.removeCoin = function(txId, outIndex) {
  verify.txId(txId)
  verify.number(outIndex)

  var record = _.find(this._getCoinRecords(), { txId: txId, outIndex: outIndex })
  if (_.isUndefined(record))
    return null

  var records = _.without(this._getCoinRecords(), record)
  this._saveCoinRecords(records)

  // clone not needed, record alrady not in cache
  return record
}

/**
 * @return {{ txId0: number[], txId1: number[], txIdN: number[] }[]}
 */
CoinStorage.prototype._getSpendsRecords = function() {
  return this.spendsRecords
}

/**
 * @param {{ txId0: number[], txId1: number[], txIdN: number[] }[]}
 */
CoinStorage.prototype._saveSpendsRecords = function(records) {
  this.store.set(this.spendsDbKey, records)
  this.spendsRecords = records
}

/**
 * @param {string} txId
 * @param {number} outIndex
 */
CoinStorage.prototype.markCoinAsSpent = function(txId, outIndex) {
  verify.txId(txId)
  verify.number(outIndex)

  var records = this._getSpendsRecords()
  var txOutIndices = records[txId] || []

  if (txOutIndices.indexOf(outIndex) === -1) {
    txOutIndices.push(outIndex)
    records[txId] = txOutIndices
    this._saveSpendsRecords(records)
  }
}

/**
 * @param {string} txId
 * @param {number} outIndex
 */
CoinStorage.prototype.markCoinAsUnspent = function(txId, outIndex) {
  verify.txId(txId)
  verify.number(outIndex)

  var records = this._getSpendsRecords()
  var txOutIndices = records[txId] || []

  if (txOutIndices.indexOf(outIndex) !== -1) {
    txOutIndices = txOutIndices.filter(function(oi) { return oi !== outIndex })
    if (txOutIndices.length > 0)
      records[txId] = txOutIndices
    else
      delete records[txId]
    this._saveSpendsRecords(records)
  }
}

/**
 * @param {string} txId
 * @param {number} outIndex
 * @return {boolean}
 */
CoinStorage.prototype.isSpent = function(txId, outIndex) {
  verify.txId(txId)
  verify.number(outIndex)

  var txOutIndices = this._getSpendsRecords()[txId] || []
  return txOutIndices.indexOf(outIndex) !== -1
}

/**
 */
CoinStorage.prototype.clear = function() {
  this.store.remove(this.coinsDbKey)
  this.store.remove(this.coinsDbKey + '_version')
  this.store.remove(this.spendsDbKey)
  this.store.remove(this.spendsDbKey + '_version')
}


module.exports = CoinStorage
