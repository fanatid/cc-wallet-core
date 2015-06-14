'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var IndexedDBProvider = require('coloredcoinjs-lib').storage.providers.IndexedDB

var AbstractSyncAddressesStorage = require('./abstractsync')

/**
 * @class AddressesIndexedDBStorage
 * @extends AbstractSyncAddressesStorage
 * @param {Object} [opts]
 * @param {string} [opts.dbName=ccwallet-addresses]
 */
function AddressesIndexedDBStorage (opts) {
  this._opts = _.extend({dbName: 'ccwallet-addresses'}, opts)
  this._storage = new IndexedDBProvider(this._opts.dbName)

  AbstractSyncAddressesStorage.call(this)
}

inherits(AddressesIndexedDBStorage, AbstractSyncAddressesStorage)

AddressesIndexedDBStorage.isAvailable = IndexedDBProvider.isAvailable

module.exports = AddressesIndexedDBStorage
