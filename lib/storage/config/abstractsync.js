'use strict'

var _ = require('lodash')
var inherits = require('util').inherits

var IConfigStorage = require('./interface')

/**
 * @class AbstractSyncConfigStorage
 * @extends IConfigStorage
 */
function AbstractSyncConfigStorage () {
  var self = this
  IConfigStorage.call(self)

  self._storage.open()
    .done(function () { self._ready() },
          function (err) { self._ready(err) })
}

inherits(AbstractSyncConfigStorage, IConfigStorage)

/**
 * @return {boolean}
 */
AbstractSyncConfigStorage.isAvailable = function () { return false }

/**
 * @param {string} key
 * @param {*} value
 * @return {Promise.<*>}
 */
AbstractSyncConfigStorage.prototype.set = function (key, value) {
  var self = this
  return self._storage.transaction(function () {
    return self._storage.set(String(key), JSON.stringify(value))
  })
  .then(function () {
    return value
  })
}

/**
 * @param {string} key
 * @param {*} [defaultValue=undefined]
 * @return {Promise.<*>}
 */
AbstractSyncConfigStorage.prototype.get = function (key, defaultValue) {
  var self = this
  return self._storage.transaction(function () {
    return self._storage.get(String(key))
  })
  .then(function (value) {
    if (value === null) {
      return defaultValue
    }

    return JSON.parse(value)
  })
}

/**
 * @return {Promise}
 */
AbstractSyncConfigStorage.prototype.clear = function () {
  var self = this
  return self._storage.transaction(function () {
    return self._storage.clear()
  })
  .then(_.noop)
}

module.exports = AbstractSyncConfigStorage
