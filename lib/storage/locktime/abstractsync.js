'use strict'

var _ = require('lodash')
var inherits = require('util').inherits

var ILockTimeStorage = require('./interface')

/**
 * @class AbstractSyncLockTimeStorage
 * @extends ILockTimeStorage
 */
function AbstractSyncLockTimeStorage () {
  var self = this
  ILockTimeStorage.call(self)

  self._storage.open()
    .done(function () { self._ready() },
          function (err) { self._ready(err) })
}

inherits(AbstractSyncLockTimeStorage, ILockTimeStorage)
_.extend(AbstractSyncLockTimeStorage, ILockTimeStorage)

/**
 * @param {string} txid
 * @param {number} oidx
 * @return {string}
 */
AbstractSyncLockTimeStorage.prototype._makeKey = function (txid, oidx) {
  return txid + ':' + oidx
}

/**
 * @param {string} txid
 * @param {number} oidx
 * @param {number} lockTime
 * @return {Promise}
 */
AbstractSyncLockTimeStorage.prototype.set = function (txid, oidx, lockTime) {
  var self = this
  return self._storage.withLock(function () {
    var key = self._makeKey(txid, oidx)
    return self._storage.set(key, lockTime.toString(10))
  })
}

/**
 * @param {string} txid
 * @param {number} oidx
 * @return {Promise.<?number>}
 */
AbstractSyncLockTimeStorage.prototype.get = function (txid, oidx) {
  var self = this
  return self._storage.withLock(function () {
    var key = self._makeKey(txid, oidx)
    return self._storage.get(key)
  })
  .then(function (value) {
    value = parseInt(value, 10)
    if (isNaN(value)) {
      return null
    }

    return value
  })
}

/**
 * @param {string} txid
 * @param {number} oidx
 * @return {Promise}
 */
AbstractSyncLockTimeStorage.prototype.remove = function (txid, oidx) {
  var self = this
  return self._storage.withLock(function () {
    var key = self._makeKey(txid, oidx)
    return self._storage.remove(key)
  })
}

/**
 * @return {Promise}
 */
AbstractSyncLockTimeStorage.prototype.clear = function () {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.clear()
  })
}

module.exports = AbstractSyncLockTimeStorage
