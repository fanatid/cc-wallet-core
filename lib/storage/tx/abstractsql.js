'use strict'

var _ = require('lodash')
var inherits = require('util').inherits

var ITxStorage = require('./interface')

var SQL = {
  create: {
    table: 'CREATE TABLE IF NOT EXISTS ccwallet_tx ( ' +
           '  txid TEXT PRIMARY KEY, ' +
           '  rawtx TEXT NOT NULL, ' +
           '  status INTEGER NOT NULL, ' +
           '  blockHeight INTEGER, ' +
           '  blockHash TEXT, ' +
           '  timestamp INTEGER NOT NULL, ' +
           '  isBlockTimestamp BOOLEAN NOT NULL)'
  },
  insert: {
    record: 'INSERT INTO ccwallet_tx ( ' +
            '    txid, ' +
            '    rawtx, ' +
            '    status, ' +
            '    blockHeight, ' +
            '    blockHash, ' +
            '    timestamp, ' +
            '    isBlockTimestamp ' +
            '  ) VALUES ($1, $2, $3, $4, $5, $6, $7)'
  },
  select: {
    all: 'SELECT * FROM ccwallet_tx',
    record: 'SELECT * FROM ccwallet_tx WHERE txid = $1'
  },
  update: {
    record: 'UPDATE ccwallet_tx ' +
            '  SET ' +
            '    rawtx = $1, ' +
            '    status = $2, ' +
            '    blockHeight = $3, ' +
            '    blockHash = $4, ' +
            '    timestamp = $5, ' +
            '    isBlockTimestamp = $6 ' +
            '  WHERE txid = $7'
  },
  delete: {
    all: 'DELETE FROM ccwallet_tx',
    record: 'DELETE FROM ccwallet_tx WHERE txid = $1'
  }
}

/**
 * @class AbstractSQLTxStorage
 * @extends ITxStorage
 */
function AbstractSQLTxStorage () {
  var self = this
  ITxStorage.call(self)

  self._storage.open()
    .then(function () {
      return self._storage.withLock(function () {
        return self._storage.executeSQL(SQL.create.table)
      })
    })
    .done(function () { self._ready() },
          function (err) { self._ready(err) })
}

inherits(AbstractSQLTxStorage, ITxStorage)
_.extend(AbstractSQLTxStorage, ITxStorage)

/**
 * @param {string} txid
 * @param {ITxStorage~RecordData} data
 * @return {Promise}
 */
AbstractSQLTxStorage.prototype.add = function (txid, data) {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.executeSQL(SQL.select.record, [txid])
      .then(function (rows) {
        if (rows.length > 0) {
          throw new Error('value for txid already exists')
        }

        var args = [
          txid,
          data.rawtx,
          data.status,
          data.blockHeight || null,
          data.blockHash || null,
          data.timestamp,
          data.isBlockTimestamp
        ]
        return self._storage.executeSQL(SQL.insert.record, args)
      })
  })
  .then(_.noop)
}

/**
 * @param {string} [txid]
 * @return {Promise.<(?ITxStorage~Record)|ITxStorage~Record[])>}
 */
AbstractSQLTxStorage.prototype.get = function (txid) {
  var self = this
  return self._storage.withLock(function () {
    var sql = SQL.select.all
    var args = []

    if (txid !== undefined) {
      sql = SQL.select.record
      args.push(txid)
    }

    return self._storage.executeSQL(sql, args)
  })
  .then(function (rows) {
    if (rows.length === 0) {
      return txid === undefined ? [] : null
    }

    rows.forEach(function (row) {
      row.isBlockTimestamp = !!row.isBlockTimestamp
    })

    return txid === undefined ? rows : rows[0]
  })
}

/**
 * @param {string} txid
 * @param {ITxStorage~RecordData} data
 * @return {Promise}
 */
AbstractSQLTxStorage.prototype.update = function (txid, data) {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.executeSQL(SQL.select.record, [txid])
      .then(function (rows) {
        if (rows.length === 0) {
          throw new Error('data for txid (' + txid + ') don\'t exists')
        }

        data = _.defaults(_.clone(data), rows[0])
        var args = [
          data.rawtx,
          data.status,
          data.blockHeight,
          data.blockHash,
          data.timestamp,
          data.isBlockTimestamp,
          txid
        ]
        return self._storage.executeSQL(SQL.update.record, args)
      })
  })
  .then(_.noop)
}

/**
 * @param {string} txid
 * @return {Promise}
 */
AbstractSQLTxStorage.prototype.remove = function (txid) {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.executeSQL(SQL.delete.record, [txid])
  })
  .then(_.noop)
}

/**
 * @return {Promise}
 */
AbstractSQLTxStorage.prototype.clear = function () {
  var self = this
  return self._storage.withLock(function (tx) {
    return self._storage.executeSQL(SQL.delete.all)
  })
  .then(_.noop)
}

module.exports = AbstractSQLTxStorage
