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
 * @property {string} address
 */

/**
 * @class CoinStorage
 * @extends SyncStorage
 *
 * Coin spends stored in separate table, because one block
 *  may contains not linking transactions and then toposort not be working
 *  It's means that in db coins not be spends, but in fact it's will be spends
 */
function CoinStorage() {
  SyncStorage.apply(this, Array.prototype.slice.call(arguments))

  this.coinsDbKey = this.globalPrefix + 'coins'
  if (!_.isArray(this.store.get(this.coinsDbKey)))
    this.store.set(this.coinsDbKey, [])

  this.spendsDbKey = this.globalPrefix + 'spends'
  if (!_.isObject(this.store.get(this.spendsDbKey)))
    this.store.set(this.spendsDbKey, {})
}

inherits(CoinStorage, SyncStorage)

/**
 * @param {CoinStorageRecord} rawCoin
 * @throws {Error} If coin already exists
 */
CoinStorage.prototype.add = function(rawCoin) {
  verify.rawCoin(rawCoin)

  var records = this.getAll()
  records.forEach(function(record) {
    if (record.txId === rawCoin.txId && record.outIndex === rawCoin.outIndex) {
      var script = bitcoin.Script.fromHex(record.script)
      var isMultisig = bitcoin.scripts.isMultisigOutput(script)

      if (isMultisig && record.address !== rawCoin.address)
        return

      throw new Error('Same coin already exists')
    }
  })

  records.push({
    txId: rawCoin.txId,
    outIndex: rawCoin.outIndex,
    value: rawCoin.value,
    script: rawCoin.script,
    address: rawCoin.address
  })

  this.store.set(this.coinsDbKey, records)
}

/**
 * @param {string} txId
 * @param {number} outIndex
 * @return {?CoinStorageRecord}
 */
CoinStorage.prototype.get = function(txId, outIndex) {
  verify.txId(txId)
  verify.number(outIndex)

  var records = this.getAll().filter(function(record) {
    return record.txId === txId && record.outIndex === outIndex
  })

  if (records.length === 1)
    return records[0]

  return null
}

/**
 * @param {string} address
 * @return {CoinStorageRecord[]}
 */
CoinStorage.prototype.getForAddress = function(address) {
  verify.string(address)

  var records = this.getAll().filter(function(record) {
    return record.address === address
  })

  return records
}

/**
 * @return {CoinStorageRecord[]}
 */
CoinStorage.prototype.getAll = function() {
  var coins = this.store.get(this.coinsDbKey) || []
  return coins
}

/**
 * @param {string} txId
 * @param {number} outIndex
 */
CoinStorage.prototype.markCoinAsSpend = function(txId, outIndex) {
  verify.txId(txId)
  verify.number(outIndex)

  var spends = this.store.get(this.spendsDbKey) || {}
  var txSpends = spends[txId] || []

  if (txSpends.indexOf(outIndex) === -1) {
    txSpends.push(outIndex)
    spends[txId] = txSpends
    this.store.set(this.spendsDbKey, spends)
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

  var spends = this.store.get(this.spendsDbKey) || {}
  var txSpends = spends[txId] || []
  return txSpends.indexOf(outIndex) !== -1
}

/**
 * Remove all coins
 */
CoinStorage.prototype.clear = function() {
  this.store.remove(this.coinsDbKey)
  this.store.remove(this.spendsDbKey)
}


module.exports = CoinStorage
