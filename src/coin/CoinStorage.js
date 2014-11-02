var inherits = require('util').inherits

var _ = require('lodash')

var bitcoin = require('../bitcoin')
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

  this._coinsDbKey = this.globalPrefix + 'coins'
  this._coinsData = this.store.get(this._coinsDbKey) || []
  this._spendsDbKey = this.globalPrefix + 'spends'
  this._spendsData = this.store.get(this._spendsDbKey) || {}

  if (_.isUndefined(this.store.get(this._coinsDbKey + '_version'))) {
    this.store.set(this._coinsDbKey + '_version', '1')

    if (this.store.get(this._coinsDbKey + '_version')) === '1') {
      var records = []
      this._getCoinRecords().forEach(function(record) {
        var exists = records.some(function(obj) {
          if ((obj.txId === record.txId && obj.outIndex === record.outIndex)
            return obj.addresses.push(record.address)
        })
        if (exists)
          return

        var newRecord = {
          txId: record.txId,
          outIndex: record.outIndex,
          value: record.value,
          script: record.script,
          addresses: [record.address]
        }
        records.push(newRecord)
      })
      this._saveCoinRecords(records)
      this.store.set(this._coinsDbKey + '_version', '2')
    }
  }

  if (_.isUndefined(this.store.get(this._spendsDbKey + '_version')))
    this.store.set(this._spendsDbKey + '_version', '1')
}

inherits(CoinStorage, SyncStorage)

/**
 * @return {CoinStorageRecord[]}
 */
CoinStorage.prototype._getCoinRecords = function() {
  return this._coinsData
}

/**
 * @param {CoinStorageRecord[]}
 */
CoinStorage.prototype._saveCoinRecords = function(data) {
  this.store.set(this._coinsDbKey, data)
  this._coinsData = data
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
 * @param {string} txId
 * @param {number} outIndex
 * @return {?CoinStorageRecord}
 */
CoinStorage.prototype.getCoin = function(txId, outIndex) {
  verify.txId(txId)
  verify.number(outIndex)

  var record = _.find(this._getCoinRecords(), function(obj) {
    return obj.txId === txId && obj.outIndex === outIndex
  })

  return record || null
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

  return records
}

/**
 * @param {string} txId
 * @param {number} outIndex
 * @return {?CoinStorageRecord}
 */
CoinStorage.prototype.removeCoin = function(txId, outIndex) {
  var record = this.getCoin(txId, outIndex)
  if (record === null)
    return null

  records = this._getCoinRecords().filter(function(obj) {
    return !(obj.txId === txId && obj.outIndex === outIndex)
  })
  this._saveCoinRecords(records)

  return record
}

/**
 * @return {{ txId0: number[], txId1: number[], txIdN: number[] }}
 */
CoinStorage.prototype._getSpendsRecords = function() {
  return this._spendsData
}

/**
 * @param {{ txId0: number[], txId1: number[], txIdN: number[] }}
 */
CoinStorage.prototype._saveSpendsRecords = function(data) {
  this.store.set(this._spendsDbKey, data)
  this._spendsData = data
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
  this.store.remove(this._coinsDbKey)
  this.store.remove(this._spendsDbKey)
}


module.exports = CoinStorage
