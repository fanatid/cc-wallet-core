'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var LocalStorage = require('odd-storage')(Promise).LocalStorage

var AbstractSyncConfigStorage = require('./abstractsync')

/**
 * @class ConfigLocalStorage
 * @extends AbstractSyncConfigStorage
 * @param {Object} [opts]
 * @param {string} [opts.prefix=ccwallet-config]
 */
function ConfigLocalStorage (opts) {
  opts = _.extend({prefix: 'ccwallet-config'}, opts)
  this._storage = new LocalStorage(opts)

  AbstractSyncConfigStorage.call(this)
}

inherits(ConfigLocalStorage, AbstractSyncConfigStorage)
_.extend(ConfigLocalStorage, AbstractSyncConfigStorage)

ConfigLocalStorage.isAvailable = LocalStorage.isAvailable

module.exports = ConfigLocalStorage
