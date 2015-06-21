'use strict'

var _ = require('lodash')
var inherits = require('util').inherits

var IRawTxStorage = require('./interface')

/**
 * @class AbstractSyncRawTxStorage
 * @extends IRawTxStorage
 */
function AbstractSyncRawTxStorage () {
  var self = this
  IRawTxStorage.call(self)

  self._storage.open()
    .done(function () { self._ready() },
          function (err) { self._ready(err) })
}

inherits(AbstractSyncRawTxStorage, IRawTxStorage)
_.extend(AbstractSyncRawTxStorage, IRawTxStorage)

/**
 * @param {string} txid
 * @param {string} rawtx
 * @return {Promise}
 */
AbstractSyncRawTxStorage.prototype.add = function (txid, rawtx) {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.get(txid)
      .then(function (data) {
        if (data !== null) {
          if (data === rawtx) {
            return
          }

          throw new Error('value for txid already exists')
        }

        return self._storage.set(txid, rawtx)
      })
  })
}

/**
 * @param {string} txid
 * @return {Promise.<?string>}
 */
AbstractSyncRawTxStorage.prototype.get = function (txid) {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.get(txid)
  })
}

/**
 * @param {string} txid
 * @return {Promise}
 */
AbstractSyncRawTxStorage.prototype.remove = function (txid) {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.remove(txid)
  })
}

/**
 * @return {Promise}
 */
AbstractSyncRawTxStorage.prototype.clear = function () {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.clear()
  })
}

module.exports = AbstractSyncRawTxStorage
