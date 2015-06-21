'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var WebSQLStorage = require('odd-storage')(Promise).WebSQL

var AbstractSQLAssetDefinitionStorage = require('./abstractsql')

/**
 * @class AssetDefinitionWebSQLStorage
 * @extends AbstractSQLAssetDefinitionStorage
 * @param {Object} [opts]
 * @param {string} [opts.dbName=ccwallet]
 * @param {number} [opts.dbSize=5] In MB
 */
function AssetDefinitionWebSQLStorage (opts) {
  opts = _.extend({dbName: 'ccwallet', dbSize: 5}, opts)
  this._storage = new WebSQLStorage(opts)

  AbstractSQLAssetDefinitionStorage.call(this)
}

inherits(AssetDefinitionWebSQLStorage, AbstractSQLAssetDefinitionStorage)
_.extend(AssetDefinitionWebSQLStorage, AbstractSQLAssetDefinitionStorage)

AssetDefinitionWebSQLStorage.isAvailable = WebSQLStorage.isAvailable

module.exports = AssetDefinitionWebSQLStorage
