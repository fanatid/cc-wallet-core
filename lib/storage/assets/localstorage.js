'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var LocalStorageProvider = require('coloredcoinjs-lib').storage.providers.LocalStorage

var AbstractSyncAssetDefinitionStorage = require('./abstractsync')

/**
 * @class AssetDefinitionLocalStorage
 * @extends AbstractSyncAssetDefinitionStorage
 * @param {Object} [opts]
 * @param {string} [opts.prefix=ccwallet-assets]
 */
function AssetDefinitionLocalStorage (opts) {
  opts = _.extend({prefix: 'ccwallet-assets'}, opts)
  this._storage = new LocalStorageProvider(opts.prefix)

  AbstractSyncAssetDefinitionStorage.call(this)
}

inherits(AssetDefinitionLocalStorage, AbstractSyncAssetDefinitionStorage)

AssetDefinitionLocalStorage.isAvailable = LocalStorageProvider.isAvailable

module.exports = AssetDefinitionLocalStorage
