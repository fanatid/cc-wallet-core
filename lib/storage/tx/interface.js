'use strict'

var Promise = require('bluebird')
var ReadyMixin = require('ready-mixin')(Promise)

var errors = require('../../errors')

/**
 * @typedef {Object} ITxStorage~RecordData
 * @property {string} rawtx
 * @property {number} status
 * @property {?number} blockHeight
 * @property {?string} blockHash
 * @property {number} timestamp
 * @property {boolean} isBlockTimestamp
 */

/**
 * @typedef {ITxStorage~RecordData} ITxStorage~Record
 * @property {string} txid
 */

/**
 * @class ITxStorage
 * @mixes ReadyMixin
 */
function ITxStorage () {}

ReadyMixin(ITxStorage.prototype)

/**
 * @return {boolean}
 */
ITxStorage.isAvailable = function () { return false }

/**
 * @param {string} txid
 * @param {ITxStorage~RecordData} data
 * @return {Promise}
 */
ITxStorage.prototype.add = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.add'))
}

/**
 * @param {string} [txid]
 * @return {Promise.<(?ITxStorage~Record)|ITxStorage~Record[])>}
 */
ITxStorage.prototype.get = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.get'))
}

/**
 * @param {string} txid
 * @param {ITxStorage~RecordData} data
 * @return {Promise}
 */
ITxStorage.prototype.update = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.update'))
}

/**
 * @param {string} txid
 * @return {Promise}
 */
ITxStorage.prototype.remove = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.remove'))
}

/**
 * @return {Promise}
 */
ITxStorage.prototype.clear = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.clear'))
}

module.exports = ITxStorage
