var Promise = require('bluebird')
var ReadyMixin = require('ready-mixin')(Promise)

var errors = require('../../errors')

/**
 * @typedef {Object} IAddressesStorage~Record
 * @property {number} account Always equal 0
 * @property {number} chain
 * @property {number} index
 * @property {string} pubkey HEX string in DER format
 */

/**
 * @class IAddressesStorage
 * @mixes ReadyMixin
 */
function IAddressesStorage () {}

ReadyMixin(IAddressesStorage.prototype)

/**
 * @return {boolean}
 */
IAddressesStorage.isAvailable = function () { return false }

/**
 * @param {IAddressesStorage~Record} data
 * @return {Promise.<IAddressesStorage~Record>}
 */
IAddressesStorage.prototype.add = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.add'))
}

/**
 * @param {{account: number, chain: number}} [opts]
 * @return {Promise.<IAddressesStorage~Record[]>}
 */
IAddressesStorage.prototype.get = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.get'))
}

/**
 * @return {Promise}
 */
IAddressesStorage.prototype.clear = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.clear'))
}

module.exports = IAddressesStorage
