var _ = require('lodash')
var inherits = require('util').inherits
var WebSQLProvider = require('coloredcoinjs-lib').storage.providers.WebSQL

var AbstractSQLAssetDefinitionStorage = require('./abstractsql')

/**
 * @class AssetDefinitionWebSQLStorage
 * @extends AbstractSQLAssetDefinitionStorage
 *
 * @param {Object} [opts]
 * @param {string} [opts.dbName=ccwallet-defintions]
 * @param {number} [opts.dbSize=5] In MB
 */
function AssetDefinitionWebSQLStorage (opts) {
  this._opts = _.extend({
    dbName: 'ccwallet-definitions',
    dbSize: 5
  }, opts)

  var provider = new WebSQLProvider(this._opts.dbName, this._opts.dbSize)
  AbstractSQLAssetDefinitionStorage.call(this, provider)
}

inherits(AssetDefinitionWebSQLStorage, AbstractSQLAssetDefinitionStorage)

AssetDefinitionWebSQLStorage.isAvailable = WebSQLProvider.isAvailable

module.exports = AssetDefinitionWebSQLStorage
