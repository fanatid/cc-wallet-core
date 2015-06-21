'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var SQLiteStorage = require('odd-storage')(Promise).SQLite

var AbstractSQLConfigStorage = require('./abstractsql')

/**
 * @class ConfigSQLiteStorage
 * @extends AbstractSQLConfigStorage
 * @param {Object} [opts]
 * @param {string} [opts.filename=ccwallet.sqlite3]
 */
function ConfigSQLiteStorage (opts) {
  opts = _.extend({filename: 'ccwallet.sqlite3'}, opts)
  this._storage = new SQLiteStorage(opts)

  AbstractSQLConfigStorage.call(this)
}

inherits(ConfigSQLiteStorage, AbstractSQLConfigStorage)
_.extend(ConfigSQLiteStorage, AbstractSQLConfigStorage)

ConfigSQLiteStorage.isAvailable = SQLiteStorage.isAvailable

module.exports = ConfigSQLiteStorage
