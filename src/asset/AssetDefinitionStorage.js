var inherits = require('util').inherits

var _ = require('lodash')

var SyncStorage = require('../SyncStorage')
var verify = require('../verify')


/**
 * @typedef {Object} AssetDefinitionRecord
 * @param {string} id
 * @param {string[]} monikers
 * @param {string[]} colorDescs
 * @param {number} unit
 */

/**
 * @class AssetDefinitionStorage
 * @extends SyncStorage
 */
function AssetDefinitionStorage() {
  SyncStorage.apply(this, Array.prototype.slice.call(arguments))

  this.assetsDbKey = this.globalPrefix + 'AssetDefinitions'
  this.assetRecords = this.store.get(this.assetsDbKey) || []

  if (_.isUndefined(this.store.get(this.assetsDbKey + '_version'))) {
    this.store.set(this.assetsDbKey + '_version', '1')
  }

  if (this.store.get(this.assetsDbKey + '_version') === '1') {
    this.store.set(this.assetsDbKey + '_version', 2)
  }
}

inherits(AssetDefinitionStorage, SyncStorage)

/**
 * @return {AssetDefinitionRecord[]}
 */
AssetDefinitionStorage.prototype._getRecords = function() {
  return this.assetRecords
}

/**
 * @param {AssetDefinitionRecord[]}
 */
AssetDefinitionStorage.prototype._saveRecords = function(records) {
  this.assetRecords = records
  this.store.set(this.assetsDbKey, records)
}

/**
 * @param {AssetDefinitionRecord} data
 * @throws {?Error} If data.id or moniker from data.monikers already exists
 */
AssetDefinitionStorage.prototype.add = function(data) {
  verify.object(data)
  verify.string(data.id)
  verify.array(data.monikers)
  data.monikers.forEach(verify.string)
  verify.array(data.colorDescs)
  data.colorDescs.forEach(verify.string)
  verify.number(data.unit)

  var records = this._getRecords()
  records.forEach(function(record) {
    if (record.id === data.id)
      throw new Error('exists asset already have same id')

    var someMoniker = data.monikers.some(function(moniker) { return record.monikers.indexOf(moniker) !== -1 })
    if (someMoniker)
      throw new Error('exists asset already have same moniker')

    var someColorDesc = data.colorDescs.some(function(cs) { return record.colorDescs.indexOf(cs) !== -1 })
    if (someColorDesc)
      throw new Error('exists asset already have same colorDesc')
  })

  records.push({
    id: data.id,
    monikers: data.monikers,
    colorDescs: data.colorDescs,
    unit: data.unit
  })
  this._saveRecords(records)
}

/**
 * @param {string} moniker
 * @return {?AssetDefinitionRecord}
 */
AssetDefinitionStorage.prototype.getByMoniker = function(moniker) {
  verify.string(moniker)

  var record = _.find(this._getRecords(), function(record) {
    return record.monikers.indexOf(moniker) !== -1
  })

  return _.isUndefined(record) ? null : _.cloneDeep(record)
}

/**
 * @param {string} desc
 * @return {?AssetDefinitionRecord}
 */
AssetDefinitionStorage.prototype.getByDesc = function(desc) {
  verify.string(desc)

  var record = _.find(this._getRecords(), function(record) {
    return record.colorDescs.indexOf(desc) !== -1
  })

  return _.isUndefined(record) ? null : _.cloneDeep(record)
}

/*
 * @return {AssetDefinitionRecord[]}
 */
AssetDefinitionStorage.prototype.getAll  =function() {
  return _.cloneDeep(this._getRecords())
}

/**
 * Drop all asset definions
 */
AssetDefinitionStorage.prototype.clear = function() {
  this.store.remove(this.assetsDbKey)
  this.store.remove(this.assetsDbKey + '_version')
}


module.exports = AssetDefinitionStorage
