'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var MemoryStorage = require('odd-storage')(Promise).Memory

var AbstractSyncAssetDefinitionStorage = require('./abstractsync')

/**
 * @class AssetDefinitionMemoryStorage
 * @extends AbstractSyncAssetDefinitionStorage
 */
function AssetDefinitionMemoryStorage () {
  this._storage = new MemoryStorage()

  AbstractSyncAssetDefinitionStorage.call(this)
}

inherits(AssetDefinitionMemoryStorage, AbstractSyncAssetDefinitionStorage)
_.extend(AssetDefinitionMemoryStorage, AbstractSyncAssetDefinitionStorage)

AssetDefinitionMemoryStorage.isAvailable = MemoryStorage.isAvailable

module.exports = AssetDefinitionMemoryStorage
