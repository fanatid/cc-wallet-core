'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var SQLiteProvider = require('coloredcoinjs-lib').storage.providers.SQLite

var AbstractSQLConfigStorage = require('./abstractsql')

/**
 * @class ConfigSQLiteStorage
 * @extends AbstractSQLConfigStorage
 * @param {Object} [opts]
 * @param {string} [opts.filename=ccwallet.sqlite3]
 */
function ConfigSQLiteStorage (opts) {
  opts = _.extend({filename: 'ccwallet.sqlite3'}, opts)
  this._storage = new SQLiteProvider(opts.filename)

  AbstractSQLConfigStorage.call(this)
}

inherits(ConfigSQLiteStorage, AbstractSQLConfigStorage)

ConfigSQLiteStorage.isAvailable = SQLiteProvider.isAvailable

module.exports = ConfigSQLiteStorage
