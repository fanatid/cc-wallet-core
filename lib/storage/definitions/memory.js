var inherits = require('util').inherits
var MemoryProvider = require('coloredcoinjs-lib').storage.providers.Memory

var AbstractSyncAssetDefinitionStorage = require('./abstractsync')

/**
 * @class AssetDefinitionMemoryStorage
 * @extends AbstractSyncAssetDefinitionStorage
 */
function AssetDefinitionMemoryStorage () {
  var provider = new MemoryProvider()
  AbstractSyncAssetDefinitionStorage.call(this, provider)
}

inherits(AssetDefinitionMemoryStorage, AbstractSyncAssetDefinitionStorage)

AssetDefinitionMemoryStorage.isAvailable = MemoryProvider.isAvailable

module.exports = AssetDefinitionMemoryStorage
