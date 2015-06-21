'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var LocalStorage = require('odd-storage')(Promise).LocalStorage

var AbstractSyncAssetDefinitionStorage = require('./abstractsync')

/**
 * @class AssetDefinitionLocalStorage
 * @extends AbstractSyncAssetDefinitionStorage
 * @param {Object} [opts]
 * @param {string} [opts.prefix=ccwallet-assets]
 */
function AssetDefinitionLocalStorage (opts) {
  opts = _.extend({prefix: 'ccwallet-assets'}, opts)
  this._storage = new LocalStorage(opts)

  AbstractSyncAssetDefinitionStorage.call(this)
}

inherits(AssetDefinitionLocalStorage, AbstractSyncAssetDefinitionStorage)
_.extend(AssetDefinitionLocalStorage, AbstractSyncAssetDefinitionStorage)

AssetDefinitionLocalStorage.isAvailable = LocalStorage.isAvailable

module.exports = AssetDefinitionLocalStorage
