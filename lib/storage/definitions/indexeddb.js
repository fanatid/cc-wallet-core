var _ = require('lodash')
var inherits = require('util').inherits
var IndexedDBProvider = require('coloredcoinjs-lib').storage.providers.IndexedDB

var AbstractSyncAssetDefinitionStorage = require('./abstractsync')

/**
 * @class AssetDefinitionIndexedDBStorage
 * @extends AbstractSyncAssetDefinitionStorage
 * @param {Object} [opts]
 * @param {string} [opts.dbName=ccwallet-definitions]
 */
function AssetDefinitionIndexedDBStorage (opts) {
  opts = _.extend({dbName: 'ccwallet-definitions'}, opts)
  this._storage = new IndexedDBProvider(opts.dbName)

  AbstractSyncAssetDefinitionStorage.call(this)
}

inherits(AssetDefinitionIndexedDBStorage, AbstractSyncAssetDefinitionStorage)

AssetDefinitionIndexedDBStorage.isAvailable = IndexedDBProvider.isAvailable

module.exports = AssetDefinitionIndexedDBStorage
