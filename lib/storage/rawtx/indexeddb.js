'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var IndexedDBProvider = require('coloredcoinjs-lib').storage.providers.IndexedDB

var AbstractSyncRawTxStorage = require('./abstractsync')

/**
 * @class RawTxIndexedDBStorage
 * @extends AbstractSyncRawTxStorage
 * @param {Object} [opts]
 * @param {string} [opts.dbName=ccwallet-rawtx]
 */
function RawTxIndexedDBStorage (opts) {
  this._opts = _.extend({dbName: 'ccwallet-rawtx'}, opts)
  this._storage = new IndexedDBProvider(this._opts.dbName)

  AbstractSyncRawTxStorage.call(this)
}

inherits(RawTxIndexedDBStorage, AbstractSyncRawTxStorage)

RawTxIndexedDBStorage.isAvailable = IndexedDBProvider.isAvailable

module.exports = RawTxIndexedDBStorage
