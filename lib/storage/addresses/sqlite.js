var _ = require('lodash')
var inherits = require('util').inherits
var SQLiteProvider = require('coloredcoinjs-lib').storage.providers.SQLite

var AbstractSQLAddressesStorage = require('./abstractsql')

/**
 * @class AddressesSQLiteStorage
 * @extends AbstractSQLAddressesStorage
 * @param {Object} [opts]
 * @param {string} [opts.filename=ccwallet.sqlite3]
 */
function AddressesSQLiteStorage (opts) {
  opts = _.extend({filename: 'ccwallet.sqlite3'}, opts)
  this._storage = new SQLiteProvider(opts.filename)

  AbstractSQLAddressesStorage.call(this)
}

inherits(AddressesSQLiteStorage, AbstractSQLAddressesStorage)

AddressesSQLiteStorage.isAvailable = SQLiteProvider.isAvailable

module.exports = AddressesSQLiteStorage
