'use strict'

var _ = require('lodash')
var inherits = require('util').inherits

var IConfigStorage = require('./interface')

var SQL = {
  create: {
    table: 'CREATE TABLE IF NOT EXISTS ccwallet_config ( ' +
           '  key TEXT PRIMARY KEY, ' +
           '  value TEXT)'
  },
  insert: {
    value: 'INSERT INTO ccwallet_config (key, value) VALUES ($1, $2)'
  },
  update: {
    value: 'UPDATE ccwallet_config SET value = $2 WHERE key = $1'
  },
  select: {
    value: 'SELECT value FROM ccwallet_config WHERE key = $1'
  },
  delete: {
    all: 'DELETE FROM ccwallet_config'
  }
}

/**
 * @class AbstractSQLConfigStorage
 * @extends IConfigStorage
 */
function AbstractSQLConfigStorage () {
  var self = this
  IConfigStorage.call(self)

  self._storage.open()
    .then(function () {
      return self._storage.transaction(function () {
        return self._storage.executeSQL(SQL.create.table)
      })
    })
    .done(function () { self._ready() },
          function (err) { self._ready(err) })
}

inherits(AbstractSQLConfigStorage, IConfigStorage)

/**
 * @return {boolean}
 */
AbstractSQLConfigStorage.isAvailable = function () { return false }

/**
 * @param {string} key
 * @param {*} value
 * @return {Promise}
 */
AbstractSQLConfigStorage.prototype.set = function (key, value) {
  var self = this
  return self._storage.transaction(function () {
    return self._storage.executeSQL(SQL.select.value, [key])
      .then(function (rows) {
        var sql = rows.length === 0 ? SQL.insert.value : SQL.update.value
        var args = [key, JSON.stringify(value)]
        return self._storage.executeSQL(sql, args)
      })
  })
  .then(_.noop)
}

/**
 * @param {string} key
 * @param {*} [defaultValue=undefined]
 * @return {Promise.<*>}
 */
AbstractSQLConfigStorage.prototype.get = function (key, defaultValue) {
  var self = this
  return self._storage.transaction(function () {
    return self._storage.executeSQL(SQL.select.value, [key])
  })
  .then(function (rows) {
    if (rows.length === 0) {
      return defaultValue
    }

    return JSON.parse(rows[0].value)
  })
}

/**
 * @return {Promise}
 */
AbstractSQLConfigStorage.prototype.clear = function () {
  var self = this
  return self._storage.transaction(function () {
    return self._storage.executeSQL(SQL.delete.all)
  })
  .then(_.noop)
}

module.exports = AbstractSQLConfigStorage
