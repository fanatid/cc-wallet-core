var _ = require('lodash')
var inherits = require('util').inherits
var IndexedDBProvider = require('coloredcoinjs-lib').storage.providers.IndexedDB

var AbstractSyncAssetDefinitionStorage = require('./abstractsync')

/**
 * @class AssetDefinitionIndexedDBStorage
 * @extends AbstractSyncAssetDefinitionStorage
 *
 * @param {Object} [opts]
 * @param {string} [opts.dbName=ccwallet-definitions]
 */
function AssetDefinitionIndexedDBStorage (opts) {
  this._opts = _.extend({
    dbName: 'ccwallet-definitions'
  }, opts)

  var provider = new IndexedDBProvider(this._opts.dbName)
  AbstractSyncAssetDefinitionStorage.call(this, provider)
}

inherits(AssetDefinitionIndexedDBStorage, AbstractSyncAssetDefinitionStorage)

AssetDefinitionIndexedDBStorage.isAvailable = IndexedDBProvider.isAvailable

module.exports = AssetDefinitionIndexedDBStorage
