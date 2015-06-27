'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var SQLiteStorage = require('odd-storage')(Promise).SQLite

var AbstractSQLTxStorage = require('./abstractsql')

/**
 * @class TxSQLiteStorage
 * @extends AbstractSQLTxStorage
 * @param {Object} [opts]
 * @param {string} [opts.filename=ccwallet.sqlite3]
 */
function TxSQLiteStorage (opts) {
  opts = _.extend({filename: 'ccwallet.sqlite3'}, opts)
  this._storage = new SQLiteStorage(opts)

  AbstractSQLTxStorage.call(this)
}

inherits(TxSQLiteStorage, AbstractSQLTxStorage)
_.extend(TxSQLiteStorage, AbstractSQLTxStorage)

TxSQLiteStorage.isAvailable = SQLiteStorage.isAvailable

module.exports = TxSQLiteStorage
