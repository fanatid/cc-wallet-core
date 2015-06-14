'use strict'

var Promise = require('bluebird')
var ReadyMixin = require('ready-mixin')(Promise)

var errors = require('../../errors')

/**
 * @class IRawTxStorage
 * @mixes ReadyMixin
 */
function IRawTxStorage () {}

ReadyMixin(IRawTxStorage.prototype)

/**
 * @return {boolean}
 */
IRawTxStorage.isAvailable = function () { return false }

/**
 * @param {string} txid
 * @param {string} rawtx
 * @return {Promise}
 */
IRawTxStorage.prototype.add = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.add'))
}

/**
 * @param {string} txid
 * @return {Promise.<?string>}
 */
IRawTxStorage.prototype.get = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.get'))
}

/**
 * @param {string} txid
 * @return {Promise}
 */
IRawTxStorage.prototype.remove = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.remove'))
}

/**
 * @return {Promise}
 */
IRawTxStorage.prototype.clear = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.clear'))
}

module.exports = IRawTxStorage
