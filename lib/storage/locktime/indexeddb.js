'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var IndexedDBStorage = require('odd-storage')(Promise).IndexedDB

var AbstractSyncLockTimeStorage = require('./abstractsync')

/**
 * @class LockTimeIndexedDBStorage
 * @extends AbstractSyncLockTimeStorage
 * @param {Object} [opts]
 * @param {string} [opts.dbName=ccwallet-locktime]
 */
function LockTimeIndexedDBStorage (opts) {
  opts = _.extend({dbName: 'ccwallet-locktime'}, opts)
  this._storage = new IndexedDBStorage(opts)

  AbstractSyncLockTimeStorage.call(this)
}

inherits(LockTimeIndexedDBStorage, AbstractSyncLockTimeStorage)
_.extend(LockTimeIndexedDBStorage, AbstractSyncLockTimeStorage)

LockTimeIndexedDBStorage.isAvailable = IndexedDBStorage.isAvailable

module.exports = LockTimeIndexedDBStorage
