'use strict'

var inherits = require('util').inherits
var MemoryProvider = require('coloredcoinjs-lib').storage.providers.Memory

var AbstractSyncRawTxStorage = require('./abstractsync')

/**
 * @class RawTxMemoryStorage
 * @extends AbstractSyncRawTxStorage
 */
function RawTxMemoryStorage () {
  this._storage = new MemoryProvider()

  AbstractSyncRawTxStorage.call(this)
}

inherits(RawTxMemoryStorage, AbstractSyncRawTxStorage)

RawTxMemoryStorage.isAvailable = MemoryProvider.isAvailable

module.exports = RawTxMemoryStorage
