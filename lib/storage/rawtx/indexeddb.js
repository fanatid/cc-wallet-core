'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var IndexedDBStorage = require('odd-storage')(Promise).IndexedDB

var AbstractSyncRawTxStorage = require('./abstractsync')

/**
 * @class RawTxIndexedDBStorage
 * @extends AbstractSyncRawTxStorage
 * @param {Object} [opts]
 * @param {string} [opts.dbName=ccwallet-rawtx]
 */
function RawTxIndexedDBStorage (opts) {
  opts = _.extend({dbName: 'ccwallet-rawtx'}, opts)
  this._storage = new IndexedDBStorage(opts)

  AbstractSyncRawTxStorage.call(this)
}

inherits(RawTxIndexedDBStorage, AbstractSyncRawTxStorage)
_.extend(RawTxIndexedDBStorage, AbstractSyncRawTxStorage)

RawTxIndexedDBStorage.isAvailable = IndexedDBStorage.isAvailable

module.exports = RawTxIndexedDBStorage
