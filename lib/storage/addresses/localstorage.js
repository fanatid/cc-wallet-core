'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var LocalStorageProvider = require('coloredcoinjs-lib').storage.providers.LocalStorage

var AbstractSyncAddressesStorage = require('./abstractsync')

/**
 * @class AddressesLocalStorage
 * @extends AbstractSyncAddressesStorage
 * @param {Object} [opts]
 * @param {string} [opts.prefix=ccwallet-addresses]
 */
function AddressesLocalStorage (opts) {
  opts = _.extend({prefix: 'ccwallet-addresses'}, opts)
  this._storage = new LocalStorageProvider(opts.prefix)

  AbstractSyncAddressesStorage.call(this)
}

inherits(AddressesLocalStorage, AbstractSyncAddressesStorage)

AddressesLocalStorage.isAvailable = LocalStorageProvider.isAvailable

module.exports = AddressesLocalStorage
