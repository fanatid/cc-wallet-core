'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var WebSQLStorage = require('odd-storage')(Promise).WebSQL

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
  this._storage = new WebSQLStorage(opts)

  AbstractSQLConfigStorage.call(this)
}

inherits(ConfigWebSQLStorage, AbstractSQLConfigStorage)
_.extend(ConfigWebSQLStorage, AbstractSQLConfigStorage)

ConfigWebSQLStorage.isAvailable = WebSQLStorage.isAvailable

module.exports = ConfigWebSQLStorage
