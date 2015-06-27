'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var MemoryStorage = require('odd-storage')(Promise).Memory

var AbstractSyncTxStorage = require('./abstractsync')

/**
 * @class TxMemoryStorage
 * @extends AbstractSyncTxStorage
 */
function TxMemoryStorage () {
  this._storage = new MemoryStorage()

  AbstractSyncTxStorage.call(this)
}

inherits(TxMemoryStorage, AbstractSyncTxStorage)
_.extend(TxMemoryStorage, AbstractSyncTxStorage)

TxMemoryStorage.isAvailable = MemoryStorage.isAvailable

module.exports = TxMemoryStorage
