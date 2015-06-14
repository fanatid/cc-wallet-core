'use strict'

var Promise = require('bluebird')
var ReadyMixin = require('ready-mixin')(Promise)

var errors = require('../../errors')

/**
 * @typedef {Object} IAssetDefinitionStorage~Record
 * @property {string} id
 * @property {string[]} monikers
 * @property {string[]} cdescs
 * @property {number} unit
 */

/**
 * @class IAssetDefinitionStorage
 * @mixes ReadyMixin
 */
function IAssetDefinitionStorage () {}

ReadyMixin(IAssetDefinitionStorage.prototype)

/**
 * @return {boolean}
 */
IAssetDefinitionStorage.isAvailable = function () { return false }

/**
 * @param {IAssetDefinitionStorage~Record} data
 * @param {Object} [opts]
 * @param {boolean} [opts.autoAdd=true]
 * @return {Promise.<{record: ?IAssetDefinitionStorage~Record, new: ?boolean}>}
 */
IAssetDefinitionStorage.prototype.resolve = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.resolve'))
}

/**
 * @param {Object} [opts]
 * @param {string} [opts.moniker]
 * @param {string} [opts.cdesc]
 * @return {Promise.<(
 *   ?IAssetDefinitionStorage~Record|
 *   IAssetDefinitionStorage~Record[]
 * )>}
 */
IAssetDefinitionStorage.prototype.get = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.get'))
}

/**
 * @return {Promise}
 */
IAssetDefinitionStorage.prototype.clear = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.clear'))
}

module.exports = IAssetDefinitionStorage
