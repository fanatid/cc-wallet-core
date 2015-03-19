var inherits = require('util').inherits

var _ = require('lodash')

var SyncStorage = require('./SyncStorage')


/**
 * @class ConfigStorage
 * @extends SyncStorage
 */
function ConfigStorage() {
  SyncStorage.apply(this, Array.prototype.slice.call(arguments))

  this.configDbKey = this.globalPrefix + 'config'
  this.configRecords = this.store.get(this.configDbKey) || {}

  if (_.isUndefined(this.store.get(this.configDbKey + '_version'))) {
    this.store.set(this.configDbKey + '_version', '1')
  }

  if (this.store.get(this.configDbKey + '_version') === '1') {
    this.store.set(this.configDbKey + '_version', 2)
  }
}

inherits(ConfigStorage, SyncStorage)

/**
 * @return {Array.<*>}
 */
ConfigStorage.prototype._getRecords = function () {
  return this.configRecords
}

/**
 * @param {Array.<*>} records
 */
ConfigStorage.prototype._saveRecords = function (records) {
  this.store.set(this.configDbKey, records)
  this.configRecords = records
}

/**
 * @param {string} key
 * @param {*} value
 */
ConfigStorage.prototype.set = function (key, value) {
  var config = this._getRecords()
  config[key] = value
  this._saveRecords(config)
}

/**
 * @param {string} key
 * @param {*} [defaultValue=undefined]
 * @return {*}
 */
ConfigStorage.prototype.get = function (key, defaultValue) {
  var config = this._getRecords()
  return _.isUndefined(config[key]) ? defaultValue : config[key]
}

/**
 */
ConfigStorage.prototype.clear = function () {
  this.store.remove(this.configDbKey)
  this.store.remove(this.configDbKey + '_version')
}


module.exports = ConfigStorage
