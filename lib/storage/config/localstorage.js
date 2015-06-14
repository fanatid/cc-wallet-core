'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var LocalStorageProvider = require('coloredcoinjs-lib').storage.providers.LocalStorage

var AbstractSyncConfigStorage = require('./abstractsync')

/**
 * @class ConfigLocalStorage
 * @extends AbstractSyncConfigStorage
 * @param {Object} [opts]
 * @param {string} [opts.prefix=ccwallet-config]
 */
function ConfigLocalStorage (opts) {
  opts = _.extend({prefix: 'ccwallet-config'}, opts)
  this._storage = new LocalStorageProvider(opts.prefix)

  AbstractSyncConfigStorage.call(this)
}

inherits(ConfigLocalStorage, AbstractSyncConfigStorage)

ConfigLocalStorage.isAvailable = LocalStorageProvider.isAvailable

module.exports = ConfigLocalStorage
