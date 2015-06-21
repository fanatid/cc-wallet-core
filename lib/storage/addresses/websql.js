'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var WebSQLStorage = require('odd-storage')(Promise).WebSQL

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
  this._storage = new WebSQLStorage(opts)

  AbstractSQLAddressesStorage.call(this)
}

inherits(AddressesWebSQLStorage, AbstractSQLAddressesStorage)
_.extend(AddressesWebSQLStorage, AbstractSQLAddressesStorage)

AddressesWebSQLStorage.isAvailable = WebSQLStorage.isAvailable

module.exports = AddressesWebSQLStorage
