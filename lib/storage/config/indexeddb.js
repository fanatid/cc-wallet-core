'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var IndexedDBProvider = require('coloredcoinjs-lib').storage.providers.IndexedDB

var AbstractSyncConfigStorage = require('./abstractsync')

/**
 * @class ConfigIndexedDBStorage
 * @extends AbstractSyncConfigStorage
 * @param {Object} [opts]
 * @param {string} [opts.dbName=ccwallet-config]
 */
function ConfigIndexedDBStorage (opts) {
  opts = _.extend({dbName: 'ccwallet-config'}, opts)
  this._storage = new IndexedDBProvider(opts.dbName)

  AbstractSyncConfigStorage.call(this)
}

inherits(ConfigIndexedDBStorage, AbstractSyncConfigStorage)

ConfigIndexedDBStorage.isAvailable = IndexedDBProvider.isAvailable

module.exports = ConfigIndexedDBStorage
