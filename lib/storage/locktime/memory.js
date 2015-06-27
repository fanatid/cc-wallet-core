'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var MemoryStorage = require('odd-storage')(Promise).Memory

var AbstractSyncLockTimeStorage = require('./abstractsync')

/**
 * @class LockTimeMemoryStorage
 * @extends AbstractSyncLockTimeStorage
 */
function LockTimeMemoryStorage () {
  this._storage = new MemoryStorage()

  AbstractSyncLockTimeStorage.call(this)
}

inherits(LockTimeMemoryStorage, AbstractSyncLockTimeStorage)
_.extend(LockTimeMemoryStorage, AbstractSyncLockTimeStorage)

LockTimeMemoryStorage.isAvailable = MemoryStorage.isAvailable

module.exports = LockTimeMemoryStorage
