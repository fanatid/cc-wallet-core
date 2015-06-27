'use strict'

var _ = require('lodash')
var inherits = require('util').inherits

var ILockTimeStorage = require('./interface')

var SQL = {
  create: {
    table: 'CREATE TABLE IF NOT EXISTS ccwallet_locktime ( ' +
           '  txid TEXT PRIMARY KEY, ' +
           '  oidx INTEGER NOT NULL, ' +
           '  locktime INTEGER NOT NULL)'
  },
  insert: {
    record: 'INSERT INTO ccwallet_locktime ' +
            '  (txid, oidx, locktime) VALUES ($1, $2, $3)'
  },
  select: {
    record: 'SELECT locktime FROM ccwallet_locktime ' +
            '  WHERE txid = $1 AND oidx = $2'
  },
  update: {
    record: 'UPDATE ccwallet_locktime ' +
            '  SET locktime = $1 ' +
            '  WHERE txid = $2 AND oidx = $3'
  },
  delete: {
    all: 'DELETE FROM ccwallet_locktime',
    record: 'DELETE FROM ccwallet_locktime WHERE txid = $1 AND oidx = $2'
  }
}

/**
 * @class AbstractSQLLockTimeStorage
 * @extends ILockTimeStorage
 */
function AbstractSQLLockTimeStorage () {
  var self = this
  ILockTimeStorage.call(self)

  self._storage.open()
    .then(function () {
      return self._storage.withLock(function () {
        return self._storage.executeSQL(SQL.create.table)
      })
    })
    .done(function () { self._ready() },
          function (err) { self._ready(err) })
}

inherits(AbstractSQLLockTimeStorage, ILockTimeStorage)
_.extend(AbstractSQLLockTimeStorage, ILockTimeStorage)

/**
 * @param {string} txid
 * @param {number} oidx
 * @param {number} lockTime
 * @return {Promise}
 */
AbstractSQLLockTimeStorage.prototype.set = function (txid, oidx, lockTime) {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.executeSQL(SQL.select.record, [txid, oidx])
      .then(function (rows) {
        var sql = SQL.insert.record
        var args = [txid, oidx, lockTime]
        if (rows.length > 0) {
          sql = SQL.update.record
          args = [lockTime, txid, oidx]
        }

        return self._storage.executeSQL(sql, args)
      })
  })
  .then(_.noop)
}

/**
 * @param {string} txid
 * @param {number} oidx
 * @return {Promise.<?number>}
 */
AbstractSQLLockTimeStorage.prototype.get = function (txid, oidx) {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.executeSQL(SQL.select.record, [txid, oidx])
  })
  .then(function (rows) {
    if (rows.length === 0) {
      return null
    }

    return rows[0].locktime
  })
}

/**
 * @param {string} txid
 * @param {number} oidx
 * @return {Promise}
 */
AbstractSQLLockTimeStorage.prototype.remove = function (txid, oidx) {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.executeSQL(SQL.delete.record, [txid, oidx])
  })
  .then(_.noop)
}

/**
 * @return {Promise}
 */
AbstractSQLLockTimeStorage.prototype.clear = function () {
  var self = this
  return self._storage.withLock(function (tx) {
    return self._storage.executeSQL(SQL.delete.all)
  })
  .then(_.noop)
}

module.exports = AbstractSQLLockTimeStorage
