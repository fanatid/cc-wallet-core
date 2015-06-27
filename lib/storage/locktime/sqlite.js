'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var SQLiteStorage = require('odd-storage')(Promise).SQLite

var AbstractSQLLockTimeStorage = require('./abstractsql')

/**
 * @class LockTimeSQLiteStorage
 * @extends AbstractSQLLockTimeStorage
 * @param {Object} [opts]
 * @param {string} [opts.filename=ccwallet.sqlite3]
 */
function LockTimeSQLiteStorage (opts) {
  opts = _.extend({filename: 'ccwallet.sqlite3'}, opts)
  this._storage = new SQLiteStorage(opts)

  AbstractSQLLockTimeStorage.call(this)
}

inherits(LockTimeSQLiteStorage, AbstractSQLLockTimeStorage)
_.extend(LockTimeSQLiteStorage, AbstractSQLLockTimeStorage)

LockTimeSQLiteStorage.isAvailable = SQLiteStorage.isAvailable

module.exports = LockTimeSQLiteStorage
