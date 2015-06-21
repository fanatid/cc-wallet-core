'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var IndexedDBStorage = require('odd-storage')(Promise).IndexedDB

var AbstractSyncAssetDefinitionStorage = require('./abstractsync')

/**
 * @class AssetDefinitionIndexedDBStorage
 * @extends AbstractSyncAssetDefinitionStorage
 * @param {Object} [opts]
 * @param {string} [opts.dbName=ccwallet-assets]
 */
function AssetDefinitionIndexedDBStorage (opts) {
  opts = _.extend({dbName: 'ccwallet-assets'}, opts)
  this._storage = new IndexedDBStorage(opts)

  AbstractSyncAssetDefinitionStorage.call(this)
}

inherits(AssetDefinitionIndexedDBStorage, AbstractSyncAssetDefinitionStorage)
_.extend(AssetDefinitionIndexedDBStorage, AbstractSyncAssetDefinitionStorage)

AssetDefinitionIndexedDBStorage.isAvailable = IndexedDBStorage.isAvailable

module.exports = AssetDefinitionIndexedDBStorage
