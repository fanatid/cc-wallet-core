var events = require('events')
var inherits = require('util').inherits

var _ = require('lodash')

var AssetDefinition = require('./AssetDefinition')
var cclib = require('../cclib')
var verify = require('../verify')


/**
 * @event AssetDefinitionManager#newAsset
 * @param {AssetDefinition} assetdef
 */

/**
 * @class AssetDefinitionManager
 * @extends external:events.EventEmitter
 * @param {external:coloredcoinjs-lib.ColorDefinitionManager} cdManager
 * @param {AssetDefinitionStorage} storage
 */
function AssetDefinitionManager(cdManager, storage) {
  verify.ColorDefinitionManager(cdManager)
  verify.AssetDefinitionStorage(storage)

  events.EventEmitter.call(this)

  this.cdManager = cdManager
  this.storage = storage

  this.resolveAssetDefinition({
    monikers: ['bitcoin'],
    colorDescs: [cclib.ColorDefinitionManager.getUncolored().getDesc()],
    unit: 100000000
  })
}

inherits(AssetDefinitionManager, events.EventEmitter)

/**
 * @param {Object} data
 * @param {string[]} data.monikers
 * @param {string[]} data.colorDescs
 * @param {number} [data.unit=1]
 * @param {boolean} [autoAdd=true]
 * @return {?AssetDefinition}
 */
AssetDefinitionManager.prototype.resolveAssetDefinition = function (data, autoAdd) {
  verify.object(data)
  verify.array(data.monikers)
  data.monikers.forEach(verify.string)
  verify.array(data.colorDescs)
  data.colorDescs.forEach(verify.string)

  if (_.isUndefined(autoAdd)) { autoAdd = true }
  verify.boolean(autoAdd)

  var assetdefs = _.filter(data.monikers.map(this.getByMoniker.bind(this)))
  if (assetdefs.length > 0) {
    return assetdefs[0]
  }

  assetdefs = _.filter(data.colorDescs.map(this.getByDesc.bind(this)))
  if (assetdefs.length > 0) {
    return assetdefs[0]
  }

  if (autoAdd === false) {
    return null
  }

  var assetdef = new AssetDefinition(this.cdManager, data)
  this.storage.add({
    id: assetdef.getId(),
    monikers: assetdef.getMonikers(),
    colorDescs: assetdef.getColorSet().getColorDescs(),
    unit: assetdef.getData().unit
  })
  this.emit('newAsset', assetdef)

  return assetdef
}

/**
 * @param {string} moniker
 * @return {?AssetDefinition}
 */
AssetDefinitionManager.prototype.getByMoniker = function (moniker) {
  verify.string(moniker)

  var result = this.storage.getByMoniker(moniker)

  if (result !== null) {
    result = new AssetDefinition(this.cdManager, result)
  }

  return result
}

/**
 * @param {string} desc
 * @return {?AssetDefinition}
 */
AssetDefinitionManager.prototype.getByDesc = function (desc) {
  verify.string(desc)

  var result = this.storage.getByDesc(desc)

  if (result !== null) {
    result = new AssetDefinition(this.cdManager, result)
  }

  return result
}

/**
 * @return {AssetDefinition[]}
 */
AssetDefinitionManager.prototype.getAllAssets = function () {
  var cdManager = this.cdManager
  var assetdefs = this.storage.getAll().map(function (record) {
    return new AssetDefinition(cdManager, record)
  })

  return assetdefs
}


module.exports = AssetDefinitionManager
