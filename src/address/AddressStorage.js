var inherits = require('util').inherits

var _ = require('lodash')

var SyncStorage = require('../SyncStorage')
var verify = require('../verify')


/**
 * @typedef {Object} AddressStorageRecord
 * @param {number} account Always equal 0
 * @param {number} chain
 * @param {number} index
 * @param {string} pubKey Hex string
 */

/**
 * @class AddressStorage
 * @extends SyncStorage
 */
function AddressStorage() {
  SyncStorage.apply(this, Array.prototype.slice.call(arguments))

  this.addressesDbKey = this.globalPrefix + 'pubKeys'
  this.addressesRecords = this.store.get(this.addressesDbKey) || []

  if (_.isUndefined(this.store.get(this.addressesDbKey + '_version')))
    this.store.set(this.addressesDbKey + '_version', '1')
}

inherits(AddressStorage, SyncStorage)

/**
 * @return {AddressStorageRecord[]}
 */
AddressStorage.prototype._getRecords = function() {
  return this.addressesRecords
}

/**
 * @param {AddressStorageRecord[]}
 */
AddressStorage.prototype._saveRecords = function(records) {
  this.addressesRecords = records
  this.store.set(this.addressesDbKey, records)
}

/*
 * @param {Object} data
 * @param {number} data.chain
 * @param {number} data.index
 * @param {string} data.pubKey bitcoinjs-lib.ECPubKey in hex format
 * @return {AddressStorageRecord}
 * @throw {Error} If account, chain, index or pubKey exists
 */
AddressStorage.prototype.add = function(data) {
  verify.object(data)
  verify.number(data.chain)
  verify.number(data.index)
  verify.hexString(data.pubKey)

  var records = this._getRecords()
  records.forEach(function(record) {
    if (record.chain === data.chain && record.index === data.index)
      throw new Error('pubkey for given account, chain and index exists')

    if (record.pubKey === data.pubKey)
      throw new Error('pubKey already exists')
  })

  records.push({
    account: 0,
    chain: data.chain,
    index: data.index,
    pubKey: data.pubKey
  })
  this._saveRecords(records)

  return _.clone(_.last(records))
}

/**
 * @param {number} [chain]
 * @return {AddressStorageRecord[]}
 */
AddressStorage.prototype.getAll = function(chain) {
  var records = this._getRecords()

  if (!_.isUndefined(chain)) {
    verify.number(chain)
    records = _.filter(records, { chain: chain })
  }

  return _.cloneDeep(records)
}

/**
 * Remove all records
 */
AddressStorage.prototype.clear = function() {
  this.store.remove(this.addressesDbKey)
  this.store.remove(this.addressesDbKey + '_version')
}


module.exports = AddressStorage
