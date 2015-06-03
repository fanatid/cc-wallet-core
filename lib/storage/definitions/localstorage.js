var _ = require('lodash')
var inherits = require('util').inherits
var LocalStorageProvider = require('coloredcoinjs-lib').storage.providers.LocalStorage

var AbstractSyncAssetDefinitionStorage = require('./abstractsync')

/**
 * @class AssetDefinitionLocalStorage
 * @extends AbstractSyncAssetDefinitionStorage
 *
 * @param {Object} [opts]
 * @param {string} [opts.prefix=ccwallet-definitions]
 */
function AssetDefinitionLocalStorage (opts) {
  opts = _.extend({
    prefix: 'ccwallet-definitions'
  }, opts)

  var provider = new LocalStorageProvider(opts.prefix)
  AbstractSyncAssetDefinitionStorage.call(this, provider)
}

inherits(AssetDefinitionLocalStorage, AbstractSyncAssetDefinitionStorage)

AssetDefinitionLocalStorage.isAvailable = LocalStorageProvider.isAvailable

module.exports = AssetDefinitionLocalStorage
