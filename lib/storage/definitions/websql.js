var _ = require('lodash')
var inherits = require('util').inherits
var WebSQLProvider = require('coloredcoinjs-lib').storage.providers.WebSQL

var AbstractSQLAssetDefinitionStorage = require('./abstractsql')

/**
 * @class AssetDefinitionWebSQLStorage
 * @extends AbstractSQLAssetDefinitionStorage
 * @param {Object} [opts]
 * @param {string} [opts.dbName=ccwallet]
 * @param {number} [opts.dbSize=5] In MB
 */
function AssetDefinitionWebSQLStorage (opts) {
  opts = _.extend({dbName: 'ccwallet', dbSize: 5}, opts)
  this._storage = new WebSQLProvider(opts.dbName, opts.dbSize)

  AbstractSQLAssetDefinitionStorage.call(this)
}

inherits(AssetDefinitionWebSQLStorage, AbstractSQLAssetDefinitionStorage)

AssetDefinitionWebSQLStorage.isAvailable = WebSQLProvider.isAvailable

module.exports = AssetDefinitionWebSQLStorage
