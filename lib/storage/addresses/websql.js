var _ = require('lodash')
var inherits = require('util').inherits
var WebSQLProvider = require('coloredcoinjs-lib').storage.providers.WebSQL

var AbstractSQLAddressesStorage = require('./abstractsql')

/**
 * @class AddressesWebSQLStorage
 * @extends AbstractSQLAddressesStorage
 * @param {Object} [opts]
 * @param {string} [opts.dbName=ccwallet-addresses]
 * @param {number} [opts.dbSize=5] In MB
 */
function AddressesWebSQLStorage (opts) {
  opts = _.extend({dbName: 'ccwallet-addresses', dbSize: 5}, opts)
  this._storage = new WebSQLProvider(opts.dbName, opts.dbSize)

  AbstractSQLAddressesStorage.call(this)
}

inherits(AddressesWebSQLStorage, AbstractSQLAddressesStorage)

AddressesWebSQLStorage.isAvailable = WebSQLProvider.isAvailable

module.exports = AddressesWebSQLStorage
