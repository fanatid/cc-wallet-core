'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var MemoryStorage = require('odd-storage')(Promise).Memory

var AbstractSyncAddressesStorage = require('./abstractsync')

/**
 * @class AddressesMemoryStorage
 * @extends AbstractSyncAddressesStorage
 */
function AddressesMemoryStorage () {
  this._storage = new MemoryStorage()

  AbstractSyncAddressesStorage.call(this)
}

inherits(AddressesMemoryStorage, AbstractSyncAddressesStorage)
_.extend(AddressesMemoryStorage, AbstractSyncAddressesStorage)

AddressesMemoryStorage.isAvailable = MemoryStorage.isAvailable

module.exports = AddressesMemoryStorage
