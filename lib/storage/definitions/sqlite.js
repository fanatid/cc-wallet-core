var _ = require('lodash')
var inherits = require('util').inherits
var SQLiteProvider = require('coloredcoinjs-lib').storage.providers.SQLite

var AbstractSQLAssetDefinitionStorage = require('./abstractsql')

/**
 * @class AssetDefinitionSQLiteStorage
 * @extends AbstractSQLAssetDefinitionStorage
 *
 * @param {Object} [opts]
 * @param {string} [opts.filename=ccwallet-defintions.sqlite3]
 */
function AssetDefinitionSQLiteStorage (opts) {
  this._opts = _.extend({
    filename: 'ccwallet-definitions.sqlite3'
  }, opts)

  var provider = new SQLiteProvider(this._opts.filename)
  AbstractSQLAssetDefinitionStorage.call(this, provider)
}

inherits(AssetDefinitionSQLiteStorage, AbstractSQLAssetDefinitionStorage)

AssetDefinitionSQLiteStorage.isAvailable = SQLiteProvider.isAvailable

module.exports = AssetDefinitionSQLiteStorage
