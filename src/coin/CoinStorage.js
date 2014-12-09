var inherits = require('util').inherits

var _ = require('lodash')

var SyncStorage = require('../SyncStorage')
var util = require('../util')
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
 *
 * @param {Object} [opts]
 * @param {number} [opts.saveTimeout=1000] In milliseconds
 */
function CoinStorage(opts) {
  opts = _.extend({
    saveTimeout: 1000
  }, opts)
  verify.number(opts.saveTimeout)

  SyncStorage.apply(this, Array.prototype.slice.call(arguments))

  this._save2store = util.debounce(this._save2store, opts.saveTimeout, this)

  this.coinsDbKey = this.globalPrefix + 'coins'
  this.coinsRecords = this.store.get(this.coinsDbKey) || []
  this.spendsDbKey = this.globalPrefix + 'spends'
  this.spendsRecords = this.store.get(this.spendsDbKey) || {}

  if (_.isUndefined(this.store.get(this.coinsDbKey + '_version'))) {
    this.store.set(this.coinsDbKey + '_version', '1')
  }

  if (this.store.get(this.coinsDbKey + '_version') === '1') {
    var records = []
    this._getCoinRecords().forEach(function (record) {
      var exists = records.some(function (obj) {
        if (obj.txId === record.txId && obj.outIndex === record.outIndex) {
          return obj.addresses.push(record.address)
        }
      })
      if (!exists) {
        records.push({
          txId: record.txId,
          outIndex: record.outIndex,
          value: record.value,
          script: record.script,
          addresses: [record.address]
        })
      }
    })
    this._saveCoinRecords(records)
    this.store.set(this.coinsDbKey + '_version', '2')
  }

  if (this.store.get(this.coinsDbKey + '_version') === '2') {
    this.store.set(this.coinsDbKey + '_version', 3)
  }

  if (_.isUndefined(this.store.get(this.spendsDbKey + '_version'))) {
    this.store.set(this.spendsDbKey + '_version', '1')
  }

  if (this.store.get(this.spendsDbKey + '_version') === '1') {
    this.store.set(this.spendsDbKey + '_version', 2)
  }
}

inherits(CoinStorage, SyncStorage)

/**
 */
CoinStorage.prototype._save2store = function () {
  this.store.set(this.coinsDbKey, this.coinsRecords)
  this.store.set(this.spendsDbKey, this.spendsRecords)
}

/**
 * @return {CoinStorageRecord[]}
 */
CoinStorage.prototype._getCoinRecords = function () {
  return this.coinsRecords
}

/**
 * @param {CoinStorageRecord[]} records
 */
CoinStorage.prototype._saveCoinRecords = function (records) {
  this.coinsRecords = records
  this._save2store()
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
CoinStorage.prototype.addCoin = function (txId, outIndex, opts) {
  verify.txId(txId)
  verify.number(outIndex)
  verify.object(opts)
  verify.number(opts.value)
  verify.hexString(opts.script)
  verify.array(opts.addresses)
  opts.addresses.forEach(verify.string)

  var records = this._getCoinRecords()
  records.forEach(function (record) {
    if (record.txId === txId && record.outIndex === outIndex) {
      throw new Error('Same coin already exists')
    }
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
 * @param {string} outIndex
 * @return {boolean}
 */
CoinStorage.prototype.isCoinExists = function (txId, outIndex) {
  verify.txId(txId)
  verify.number(outIndex)

  var record = _.find(this._getCoinRecords(), {txId: txId, outIndex: outIndex})
  return !_.isUndefined(record)
}

/**
 * @param {string} address
 * @return {CoinStorageRecord[]}
 */
CoinStorage.prototype.getCoinsForAddress = function (address) {
  verify.string(address)

  var records = this._getCoinRecords().filter(function (record) {
    return record.addresses.indexOf(address) !== -1
  })

  return _.cloneDeep(records)
}

/**
 * @param {string} txId
 * @param {number} outIndex
 * @return {?CoinStorageRecord}
 */
CoinStorage.prototype.removeCoin = function (txId, outIndex) {
  verify.txId(txId)
  verify.number(outIndex)

  var record = _.find(this._getCoinRecords(), {txId: txId, outIndex: outIndex})
  if (_.isUndefined(record)) {
    return null
  }

  var records = _.without(this._getCoinRecords(), record)
  this._saveCoinRecords(records)

  // clone not needed, record alrady not in cache
  return record
}

/**
 * @return {{txId0: number[], txId1: number[], txIdN: number[]}[]}
 */
CoinStorage.prototype._getSpendsRecords = function () {
  return this.spendsRecords
}

/**
 * @param {{txId0: number[], txId1: number[], txIdN: number[]}[]} records
 */
CoinStorage.prototype._saveSpendsRecords = function (records) {
  this.spendsRecords = records
  this._save2store()
}

/**
 * @param {string} txId
 * @param {number} outIndex
 */
CoinStorage.prototype.markCoinAsSpent = function (txId, outIndex) {
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
CoinStorage.prototype.markCoinAsUnspent = function (txId, outIndex) {
  verify.txId(txId)
  verify.number(outIndex)

  var records = this._getSpendsRecords()
  var txOutIndices = records[txId] || []

  if (txOutIndices.indexOf(outIndex) !== -1) {
    txOutIndices = txOutIndices.filter(function (oi) { return oi !== outIndex })
    if (txOutIndices.length > 0) {
      records[txId] = txOutIndices

    } else {
      delete records[txId]

    }

    this._saveSpendsRecords(records)
  }
}

/**
 * @param {string} txId
 * @param {number} outIndex
 * @return {boolean}
 */
CoinStorage.prototype.isSpent = function (txId, outIndex) {
  verify.txId(txId)
  verify.number(outIndex)

  var txOutIndices = this._getSpendsRecords()[txId] || []
  return txOutIndices.indexOf(outIndex) !== -1
}

/**
 */
CoinStorage.prototype.clear = function () {
  this.store.remove(this.coinsDbKey)
  this.store.remove(this.coinsDbKey + '_version')
  this.store.remove(this.spendsDbKey)
  this.store.remove(this.spendsDbKey + '_version')
}


module.exports = CoinStorage
