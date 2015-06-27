'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var LocalStorage = require('odd-storage')(Promise).LocalStorage

var AbstractSyncTxStorage = require('./abstractsync')

/**
 * @class TxLocalStorage
 * @extends AbstractSyncTxStorage
 * @param {Object} [opts]
 * @param {string} [opts.prefix=ccwallet-tx]
 */
function TxLocalStorage (opts) {
  opts = _.extend({prefix: 'ccwallet-tx'}, opts)
  this._storage = new LocalStorage(opts)

  AbstractSyncTxStorage.call(this)
}

inherits(TxLocalStorage, AbstractSyncTxStorage)
_.extend(TxLocalStorage, AbstractSyncTxStorage)

TxLocalStorage.isAvailable = LocalStorage.isAvailable

module.exports = TxLocalStorage
