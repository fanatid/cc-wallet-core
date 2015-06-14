'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var WebSQLProvider = require('coloredcoinjs-lib').storage.providers.WebSQL

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
  this._storage = new WebSQLProvider(opts.dbName, opts.dbSize)

  AbstractSQLRawTxStorage.call(this)
}

inherits(RawTxWebSQLStorage, AbstractSQLRawTxStorage)

RawTxWebSQLStorage.isAvailable = WebSQLProvider.isAvailable

module.exports = RawTxWebSQLStorage
