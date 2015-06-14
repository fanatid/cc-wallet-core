'use strict'

var Promise = require('bluebird')
var ReadyMixin = require('ready-mixin')(Promise)

var errors = require('../../errors')

/**
 * @class IConfigStorage
 * @mixes ReadyMixin
 */
function IConfigStorage () {}

ReadyMixin(IConfigStorage.prototype)

/**
 * @return {boolean}
 */
IConfigStorage.isAvailable = function () { return false }

/**
 * @param {string} key
 * @param {*} value
 * @return {Promise.<*>}
 */
IConfigStorage.prototype.set = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.set'))
}

/**
 * @param {string} key
 * @param {*} [defaultValue=undefined]
 * @return {Promise.<*>}
 */
IConfigStorage.prototype.get = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.get'))
}

/**
 * @return {Promise}
 */
IConfigStorage.prototype.clear = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.clear'))
}

module.exports = IConfigStorage
