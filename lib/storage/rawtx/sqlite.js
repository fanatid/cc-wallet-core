'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var SQLiteProvider = require('coloredcoinjs-lib').storage.providers.SQLite

var AbstractSQLRawTxStorage = require('./abstractsql')

/**
 * @class RawTxSQLiteStorage
 * @extends AbstractSQLRawTxStorage
 * @param {Object} [opts]
 * @param {string} [opts.filename=ccwallet.sqlite3]
 */
function RawTxSQLiteStorage (opts) {
  opts = _.extend({filename: 'ccwallet.sqlite3'}, opts)
  this._storage = new SQLiteProvider(opts.filename)

  AbstractSQLRawTxStorage.call(this)
}

inherits(RawTxSQLiteStorage, AbstractSQLRawTxStorage)

RawTxSQLiteStorage.isAvailable = SQLiteProvider.isAvailable

module.exports = RawTxSQLiteStorage
