'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var LocalStorageProvider = require('coloredcoinjs-lib').storage.providers.LocalStorage

var AbstractSyncRawTxStorage = require('./abstractsync')

/**
 * @class RawTxLocalStorage
 * @extends AbstractSyncRawTxStorage
 * @param {Object} [opts]
 * @param {string} [opts.prefix=ccwallet-rawtx]
 */
function RawTxLocalStorage (opts) {
  opts = _.extend({prefix: 'ccwallet-rawtx'}, opts)
  this._storage = new LocalStorageProvider(opts.prefix)

  AbstractSyncRawTxStorage.call(this)
}

inherits(RawTxLocalStorage, AbstractSyncRawTxStorage)

RawTxLocalStorage.isAvailable = LocalStorageProvider.isAvailable

module.exports = RawTxLocalStorage
