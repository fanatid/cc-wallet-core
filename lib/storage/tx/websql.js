'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var WebSQLStorage = require('odd-storage')(Promise).WebSQL

var AbstractSQLTxStorage = require('./abstractsql')

/**
 * @class TxWebSQLStorage
 * @extends AbstractSQLTxStorage
 * @param {Object} [opts]
 * @param {string} [opts.dbName=ccwallet-tx]
 * @param {number} [opts.dbSize=50] In MB
 */
function TxWebSQLStorage (opts) {
  opts = _.extend({dbName: 'ccwallet-tx', dbSize: 50}, opts)
  this._storage = new WebSQLStorage(opts)

  AbstractSQLTxStorage.call(this)
}

inherits(TxWebSQLStorage, AbstractSQLTxStorage)
_.extend(TxWebSQLStorage, AbstractSQLTxStorage)

TxWebSQLStorage.isAvailable = WebSQLStorage.isAvailable

module.exports = TxWebSQLStorage
