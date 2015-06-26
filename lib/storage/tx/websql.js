'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var WebSQLStorage = require('odd-storage')(Promise).WebSQL

var AbstractSQLRawTxStorage = require('./abstractsql')

/**
 * @class RawTxWebSQLStorage
 * @extends AbstractSQLRawTxStorage
 * @param {Object} [opts]
 * @param {string} [opts.dbName=ccwallet-rawtx]
 * @param {number} [opts.dbSize=50] In MB
 */
function RawTxWebSQLStorage (opts) {
  opts = _.extend({dbName: 'ccwallet-rawtx', dbSize: 50}, opts)
  this._storage = new WebSQLStorage(opts)

  AbstractSQLRawTxStorage.call(this)
}

inherits(RawTxWebSQLStorage, AbstractSQLRawTxStorage)
_.extend(RawTxWebSQLStorage, AbstractSQLRawTxStorage)

RawTxWebSQLStorage.isAvailable = WebSQLStorage.isAvailable

module.exports = RawTxWebSQLStorage
