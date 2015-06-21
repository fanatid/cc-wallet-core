'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var SQLiteStorage = require('odd-storage')(Promise).SQLite

var AbstractSQLAssetDefinitionStorage = require('./abstractsql')

/**
 * @class AssetDefinitionSQLiteStorage
 * @extends AbstractSQLAssetDefinitionStorage
 * @param {Object} [opts]
 * @param {string} [opts.filename=ccwallet.sqlite3]
 */
function AssetDefinitionSQLiteStorage (opts) {
  opts = _.extend({filename: 'ccwallet.sqlite3'}, opts)
  this._storage = new SQLiteStorage(opts)

  AbstractSQLAssetDefinitionStorage.call(this)
}

inherits(AssetDefinitionSQLiteStorage, AbstractSQLAssetDefinitionStorage)
_.extend(AssetDefinitionSQLiteStorage, AbstractSQLAssetDefinitionStorage)

AssetDefinitionSQLiteStorage.isAvailable = SQLiteStorage.isAvailable

module.exports = AssetDefinitionSQLiteStorage
