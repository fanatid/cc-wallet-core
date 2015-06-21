'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var MemoryStorage = require('odd-storage')(Promise).Memory

var AbstractSyncConfigStorage = require('./abstractsync')

/**
 * @class ConfigMemoryStorage
 * @extends AbstractSyncConfigStorage
 */
function ConfigMemoryStorage () {
  this._storage = new MemoryStorage()

  AbstractSyncConfigStorage.call(this)
}

inherits(ConfigMemoryStorage, AbstractSyncConfigStorage)
_.extend(ConfigMemoryStorage, AbstractSyncConfigStorage)

ConfigMemoryStorage.isAvailable = MemoryStorage.isAvailable

module.exports = ConfigMemoryStorage
