'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var LocalStorage = require('odd-storage')(Promise).LocalStorage

var AbstractSyncRawTxStorage = require('./abstractsync')

/**
 * @class RawTxLocalStorage
 * @extends AbstractSyncRawTxStorage
 * @param {Object} [opts]
 * @param {string} [opts.prefix=ccwallet-rawtx]
 */
function RawTxLocalStorage (opts) {
  opts = _.extend({prefix: 'ccwallet-rawtx'}, opts)
  this._storage = new LocalStorage(opts)

  AbstractSyncRawTxStorage.call(this)
}

inherits(RawTxLocalStorage, AbstractSyncRawTxStorage)
_.extend(RawTxLocalStorage, AbstractSyncRawTxStorage)

RawTxLocalStorage.isAvailable = LocalStorage.isAvailable

module.exports = RawTxLocalStorage
