'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var IndexedDBStorage = require('odd-storage')(Promise).IndexedDB

var AbstractSyncTxStorage = require('./abstractsync')

/**
 * @class TxIndexedDBStorage
 * @extends AbstractSyncTxStorage
 * @param {Object} [opts]
 * @param {string} [opts.dbName=ccwallet-tx]
 */
function TxIndexedDBStorage (opts) {
  opts = _.extend({dbName: 'ccwallet-tx'}, opts)
  this._storage = new IndexedDBStorage(opts)

  AbstractSyncTxStorage.call(this)
}

inherits(TxIndexedDBStorage, AbstractSyncTxStorage)
_.extend(TxIndexedDBStorage, AbstractSyncTxStorage)

TxIndexedDBStorage.isAvailable = IndexedDBStorage.isAvailable

module.exports = TxIndexedDBStorage
