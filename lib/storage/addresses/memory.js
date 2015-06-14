'use strict'

var inherits = require('util').inherits
var MemoryProvider = require('coloredcoinjs-lib').storage.providers.Memory

var AbstractSyncAddressesStorage = require('./abstractsync')

/**
 * @class AddressesMemoryStorage
 * @extends AbstractSyncAddressesStorage
 */
function AddressesMemoryStorage () {
  this._storage = new MemoryProvider()

  AbstractSyncAddressesStorage.call(this)
}

inherits(AddressesMemoryStorage, AbstractSyncAddressesStorage)

AddressesMemoryStorage.isAvailable = MemoryProvider.isAvailable

module.exports = AddressesMemoryStorage
