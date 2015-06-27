'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var LocalStorage = require('odd-storage')(Promise).LocalStorage

var AbstractSyncLockTimeStorage = require('./abstractsync')

/**
 * @class LockTimeLocalStorage
 * @extends AbstractSyncLockTimeStorage
 * @param {Object} [opts]
 * @param {string} [opts.prefix=ccwallet-locktime]
 */
function LockTimeLocalStorage (opts) {
  opts = _.extend({prefix: 'ccwallet-locktime'}, opts)
  this._storage = new LocalStorage(opts)

  AbstractSyncLockTimeStorage.call(this)
}

inherits(LockTimeLocalStorage, AbstractSyncLockTimeStorage)
_.extend(LockTimeLocalStorage, AbstractSyncLockTimeStorage)

LockTimeLocalStorage.isAvailable = LocalStorage.isAvailable

module.exports = LockTimeLocalStorage
