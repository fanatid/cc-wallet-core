var inherits = require('util').inherits
var MemoryProvider = require('coloredcoinjs-lib').storage.providers.Memory

var AbstractSyncAssetDefinitionStorage = require('./abstractsync')

/**
 * @class AssetDefinitionMemoryStorage
 * @extends AbstractSyncAssetDefinitionStorage
 */
function AssetDefinitionMemoryStorage () {
  this._storage = new MemoryProvider()

  AbstractSyncAssetDefinitionStorage.call(this)
}

inherits(AssetDefinitionMemoryStorage, AbstractSyncAssetDefinitionStorage)

AssetDefinitionMemoryStorage.isAvailable = MemoryProvider.isAvailable

module.exports = AssetDefinitionMemoryStorage
