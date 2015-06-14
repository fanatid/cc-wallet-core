'use strict'

var inherits = require('util').inherits
var MemoryProvider = require('coloredcoinjs-lib').storage.providers.Memory

var AbstractSyncConfigStorage = require('./abstractsync')

/**
 * @class ConfigMemoryStorage
 * @extends AbstractSyncConfigStorage
 */
function ConfigMemoryStorage () {
  this._storage = new MemoryProvider()

  AbstractSyncConfigStorage.call(this)
}

inherits(ConfigMemoryStorage, AbstractSyncConfigStorage)

ConfigMemoryStorage.isAvailable = MemoryProvider.isAvailable

module.exports = ConfigMemoryStorage
