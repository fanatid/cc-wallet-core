'use strict'

var _ = require('lodash')
var inherits = require('util').inherits

var IRawTxStorage = require('./interface')

var SQL = {
  create: {
    table: 'CREATE TABLE IF NOT EXISTS ccwallet_rawtx ( ' +
           '  txid TEXT PRIMARY KEY, ' +
           '  rawtx TEXT)'
  },
  insert: {
    rawtx: 'INSERT INTO ccwallet_rawtx (txid, rawtx) VALUES ($1, $2)'
  },
  select: {
    rawtx: 'SELECT * FROM ccwallet_rawtx WHERE txid = $1'
  },
  update: {
    rawtx: 'UPDATE ccwallet_rawtx SET rawtx = $2 WHERE txid = $1'
  },
  delete: {
    all: 'DELETE FROM ccwallet_rawtx',
    rawtx: 'DELETE FROM ccwallet_rawtx WHERE txid = $1'
  }
}

/**
 * @class AbstractSQLRawTxStorage
 * @extends IRawTxStorage
 */
function AbstractSQLRawTxStorage () {
  var self = this
  IRawTxStorage.call(self)

  self._storage.open()
    .then(function () {
      return self._storage.transaction(function () {
        return self._storage.executeSQL(SQL.create.table)
      })
    })
    .done(function () { self._ready() },
          function (err) { self._ready(err) })
}

inherits(AbstractSQLRawTxStorage, IRawTxStorage)

/**
 * @return {boolean}
 */
AbstractSQLRawTxStorage.isAvailable = function () { return false }

/**
 * @param {string} txid
 * @param {string} rawtx
 * @return {Promise}
 */
AbstractSQLRawTxStorage.prototype.add = function (txid, rawtx) {
  var self = this
  return self._storage.transaction(function () {
    return self._storage.executeSQL(SQL.select.rawtx, [txid])
      .then(function (rows) {
        var sql = SQL.insert.rawtx
        if (rows.length > 0) {
          if (rows[0].rawtx !== rawtx) {
            throw new Error('value for txid already exists')
          }

          sql = SQL.update.rawtx
        }

        return self._storage.executeSQL(sql, [txid, rawtx])
      })
  })
  .then(_.noop)
}

/**
 * @param {string} txid
 * @return {Promise.<?string>}
 */
AbstractSQLRawTxStorage.prototype.get = function (txid) {
  var self = this
  return self._storage.transaction(function () {
    return self._storage.executeSQL(SQL.select.rawtx, [txid])
  })
  .then(function (rows) {
    if (rows.length === 0) {
      return null
    }

    return rows[0].rawtx
  })
}

/**
 * @param {string} txid
 * @return {Promise}
 */
AbstractSQLRawTxStorage.prototype.remove = function (txid) {
  var self = this
  return self._storage.transaction(function () {
    return self._storage.executeSQL(SQL.delete.rawtx, [txid])
  })
  .then(_.noop)
}

/**
 * @return {Promise}
 */
AbstractSQLRawTxStorage.prototype.clear = function () {
  var self = this
  return self._storage.transaction(function (tx) {
    return self._storage.executeSQL(SQL.delete.all)
  })
  .then(_.noop)
}

module.exports = AbstractSQLRawTxStorage
