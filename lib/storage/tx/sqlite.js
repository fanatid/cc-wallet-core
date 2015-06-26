'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var SQLiteStorage = require('odd-storage')(Promise).SQLite

var AbstractSQLRawTxStorage = require('./abstractsql')

/**
 * @class RawTxSQLiteStorage
 * @extends AbstractSQLRawTxStorage
 * @param {Object} [opts]
 * @param {string} [opts.filename=ccwallet.sqlite3]
 */
function RawTxSQLiteStorage (opts) {
  opts = _.extend({filename: 'ccwallet.sqlite3'}, opts)
  this._storage = new SQLiteStorage(opts)

  AbstractSQLRawTxStorage.call(this)
}

inherits(RawTxSQLiteStorage, AbstractSQLRawTxStorage)
_.extend(RawTxSQLiteStorage, AbstractSQLRawTxStorage)

RawTxSQLiteStorage.isAvailable = SQLiteStorage.isAvailable

module.exports = RawTxSQLiteStorage
