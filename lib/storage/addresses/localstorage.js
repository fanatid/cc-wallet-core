'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var LocalStorage = require('odd-storage')(Promise).LocalStorage

var AbstractSyncAddressesStorage = require('./abstractsync')

/**
 * @class AddressesLocalStorage
 * @extends AbstractSyncAddressesStorage
 * @param {Object} [opts]
 * @param {string} [opts.prefix=ccwallet-addresses]
 */
function AddressesLocalStorage (opts) {
  opts = _.extend({prefix: 'ccwallet-addresses'}, opts)
  this._storage = new LocalStorage(opts)

  AbstractSyncAddressesStorage.call(this)
}

inherits(AddressesLocalStorage, AbstractSyncAddressesStorage)
_.extend(AddressesLocalStorage, AbstractSyncAddressesStorage)

AddressesLocalStorage.isAvailable = LocalStorage.isAvailable

module.exports = AddressesLocalStorage
