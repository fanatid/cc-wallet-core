var _ = require('lodash')
var inherits = require('util').inherits
var SQLiteProvider = require('coloredcoinjs-lib').storage.providers.SQLite

var AbstractSQLAssetDefinitionStorage = require('./abstractsql')

/**
 * @class AssetDefinitionSQLiteStorage
 * @extends AbstractSQLAssetDefinitionStorage
 * @param {Object} [opts]
 * @param {string} [opts.filename=ccwallet.sqlite3]
 */
function AssetDefinitionSQLiteStorage (opts) {
  opts = _.extend({filename: 'ccwallet.sqlite3'}, opts)
  this._storage = new SQLiteProvider(opts.filename)

  AbstractSQLAssetDefinitionStorage.call(this)
}

inherits(AssetDefinitionSQLiteStorage, AbstractSQLAssetDefinitionStorage)

AssetDefinitionSQLiteStorage.isAvailable = SQLiteProvider.isAvailable

module.exports = AssetDefinitionSQLiteStorage
