'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var WebSQLProvider = require('coloredcoinjs-lib').storage.providers.WebSQL

var AbstractSQLConfigStorage = require('./abstractsql')

/**
 * @class ConfigWebSQLStorage
 * @extends AbstractSQLConfigStorage
 * @param {Object} [opts]
 * @param {string} [opts.dbName=ccwallet]
 * @param {number} [opts.dbSize=5] In MB
 */
function ConfigWebSQLStorage (opts) {
  opts = _.extend({dbName: 'ccwallet', dbSize: 5}, opts)
  this._storage = new WebSQLProvider(opts.dbName, opts.dbSize)

  AbstractSQLConfigStorage.call(this)
}

inherits(ConfigWebSQLStorage, AbstractSQLConfigStorage)

ConfigWebSQLStorage.isAvailable = WebSQLProvider.isAvailable

module.exports = ConfigWebSQLStorage
