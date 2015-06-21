'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var IndexedDBStorage = require('odd-storage')(Promise).IndexedDB

var AbstractSyncConfigStorage = require('./abstractsync')

/**
 * @class ConfigIndexedDBStorage
 * @extends AbstractSyncConfigStorage
 * @param {Object} [opts]
 * @param {string} [opts.dbName=ccwallet-config]
 */
function ConfigIndexedDBStorage (opts) {
  opts = _.extend({dbName: 'ccwallet-config'}, opts)
  this._storage = new IndexedDBStorage(opts)

  AbstractSyncConfigStorage.call(this)
}

inherits(ConfigIndexedDBStorage, AbstractSyncConfigStorage)
_.extend(ConfigIndexedDBStorage, AbstractSyncConfigStorage)

ConfigIndexedDBStorage.isAvailable = IndexedDBStorage.isAvailable

module.exports = ConfigIndexedDBStorage
