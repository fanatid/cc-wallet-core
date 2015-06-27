'use strict'

var _ = require('lodash')
var inherits = require('util').inherits

var ITxStorage = require('./interface')

/**
 * @class AbstractSyncTxStorage
 * @extends ITxStorage
 */
function AbstractSyncTxStorage () {
  var self = this
  ITxStorage.call(self)

  self._storage.open()
    .done(function () { self._ready() },
          function (err) { self._ready(err) })
}

inherits(AbstractSyncTxStorage, ITxStorage)
_.extend(AbstractSyncTxStorage, ITxStorage)

/**
 * @param {string} txid
 * @param {ITxStorage~RecordData} data
 * @return {Promise}
 */
AbstractSyncTxStorage.prototype.add = function (txid, data) {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.get(txid)
      .then(function (result) {
        if (result !== null) {
          throw new Error('value for txid already exists')
        }

        return self._storage.set(txid, JSON.stringify(data))
      })
  })
}

/**
 * @param {string} [txid]
 * @return {Promise.<(?ITxStorage~Record)|ITxStorage~Record[])>}
 */
AbstractSyncTxStorage.prototype.get = function (txid) {
  var self = this
  return self._storage.withLock(function () {
    if (txid !== undefined) {
      return self._storage.get(txid)
        .then(function (data) {
          if (data !== null) {
            data = JSON.parse(data)
            data.txid = txid
          }

          return data
        })
    }

    var list = []
    return self._storage.iterate(function (txid, row) {
      list.push(JSON.parse(row))
      _.last(list).txid = txid
    })
    .then(function () {
      return list
    })
  })
}

/**
 * @param {string} txid
 * @param {ITxStorage~RecordData} data
 * @return {Promise}
 */
AbstractSyncTxStorage.prototype.update = function (txid, data) {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.get(txid)
      .then(function (result) {
        if (result === null) {
          throw new Error('data for txid (' + txid + ') don\'t exists')
        }

        data = _.defaults(_.clone(data), JSON.parse(result))
        return self._storage.set(txid, JSON.stringify(data))
      })
  })
}

/**
 * @param {string} txid
 * @return {Promise}
 */
AbstractSyncTxStorage.prototype.remove = function (txid) {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.remove(txid)
  })
}

/**
 * @return {Promise}
 */
AbstractSyncTxStorage.prototype.clear = function () {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.clear()
  })
}

module.exports = AbstractSyncTxStorage
