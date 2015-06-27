'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var WebSQLStorage = require('odd-storage')(Promise).WebSQL

var AbstractSQLLockTimeStorage = require('./abstractsql')

/**
 * @class LockTimeWebSQLStorage
 * @extends AbstractSQLLockTimeStorage
 * @param {Object} [opts]
 * @param {string} [opts.dbName=ccwallet-locktime]
 * @param {number} [opts.dbSize=50] In MB
 */
function LockTimeWebSQLStorage (opts) {
  opts = _.extend({dbName: 'ccwallet-locktime', dbSize: 50}, opts)
  this._storage = new WebSQLStorage(opts)

  AbstractSQLLockTimeStorage.call(this)
}

inherits(LockTimeWebSQLStorage, AbstractSQLLockTimeStorage)
_.extend(LockTimeWebSQLStorage, AbstractSQLLockTimeStorage)

LockTimeWebSQLStorage.isAvailable = WebSQLStorage.isAvailable

module.exports = LockTimeWebSQLStorage
