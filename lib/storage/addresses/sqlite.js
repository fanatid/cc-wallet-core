'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var SQLiteStorage = require('odd-storage')(Promise).SQLite

var AbstractSQLAddressesStorage = require('./abstractsql')

/**
 * @class AddressesSQLiteStorage
 * @extends AbstractSQLAddressesStorage
 * @param {Object} [opts]
 * @param {string} [opts.filename=ccwallet.sqlite3]
 */
function AddressesSQLiteStorage (opts) {
  opts = _.extend({filename: 'ccwallet.sqlite3'}, opts)
  this._storage = new SQLiteStorage(opts)

  AbstractSQLAddressesStorage.call(this)
}

inherits(AddressesSQLiteStorage, AbstractSQLAddressesStorage)
_.extend(AddressesSQLiteStorage, AbstractSQLAddressesStorage)

AddressesSQLiteStorage.isAvailable = SQLiteStorage.isAvailable

module.exports = AddressesSQLiteStorage
