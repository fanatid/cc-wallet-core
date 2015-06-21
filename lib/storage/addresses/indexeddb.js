'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var IndexedDBStorage = require('odd-storage')(Promise).IndexedDB

var AbstractSyncAddressesStorage = require('./abstractsync')

/**
 * @class AddressesIndexedDBStorage
 * @extends AbstractSyncAddressesStorage
 * @param {Object} [opts]
 * @param {string} [opts.dbName=ccwallet-addresses]
 */
function AddressesIndexedDBStorage (opts) {
  opts = _.extend({dbName: 'ccwallet-addresses'}, opts)
  this._storage = new IndexedDBStorage(opts)

  AbstractSyncAddressesStorage.call(this)
}

inherits(AddressesIndexedDBStorage, AbstractSyncAddressesStorage)
_.extend(AddressesIndexedDBStorage, AbstractSyncAddressesStorage)

AddressesIndexedDBStorage.isAvailable = IndexedDBStorage.isAvailable

module.exports = AddressesIndexedDBStorage
