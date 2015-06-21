'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var MemoryStorage = require('odd-storage')(Promise).Memory

var AbstractSyncRawTxStorage = require('./abstractsync')

/**
 * @class RawTxMemoryStorage
 * @extends AbstractSyncRawTxStorage
 */
function RawTxMemoryStorage () {
  this._storage = new MemoryStorage()

  AbstractSyncRawTxStorage.call(this)
}

inherits(RawTxMemoryStorage, AbstractSyncRawTxStorage)
_.extend(RawTxMemoryStorage, AbstractSyncRawTxStorage)

RawTxMemoryStorage.isAvailable = MemoryStorage.isAvailable

module.exports = RawTxMemoryStorage
