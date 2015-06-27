'use strict'

var Promise = require('bluebird')
var ReadyMixin = require('ready-mixin')(Promise)

var errors = require('../../errors')

/**
 * @class ILockTimeStorage
 * @mixes ReadyMixin
 */
function ILockTimeStorage () {}

ReadyMixin(ILockTimeStorage.prototype)

/**
 * @return {boolean}
 */
ILockTimeStorage.isAvailable = function () { return false }

/**
 * @param {string} txid
 * @param {number} oidx
 * @param {number} lockTime
 * @return {Promise}
 */
ILockTimeStorage.prototype.set = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.set'))
}

/**
 * @param {string} txid
 * @param {number} oidx
 * @return {Promise.<?number>}
 */
ILockTimeStorage.prototype.get = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.get'))
}

/**
 * @param {string} txid
 * @param {number} oidx
 * @return {Promise}
 */
ILockTimeStorage.prototype.remove = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.remove'))
}

/**
 * @return {Promise}
 */
ILockTimeStorage.prototype.clear = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.clear'))
}

module.exports = ILockTimeStorage
