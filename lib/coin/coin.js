'use strict'

var _ = require('lodash')
var Promise = require('bluebird')

/**
 * @typedef {Object} Coin~RawCoin
 * @property {string} txid
 * @property {number} oidx
 * @property {number} value
 * @property {string} script
 */

/**
 * @class Coin
 * @param {Coin~RawCoin} rawCoin
 * @param {CoinManager} [coinManager]
 */
function Coin (coin, coinManager) {
  this.txid = coin.txid
  this.oidx = coin.oidx
  this.value = coin.value
  this.script = coin.script

  this._coinManager = coinManager
}

/**
 * @private
 * @param {string} methodName
 * @param {string} managerMethodName
 * @param {boolean} [passArguments=false]
 * @return {function}
 */
Coin._createMethod = function (methodName, managerMethodName, passArguments) {
  return function () {
    var args = []
    if (passArguments === true) {
      args = _.slice(args)
    }

    var self = this
    return Promise.try(function () {
      if (self._coinManager === undefined) {
        return Promise.reject(
          new Error('Coin havn\'t CoinManager for method ' + methodName))
      }

      args.unshift(self)
      return self._coinManager[managerMethodName].apply(self._coinManager, args)
    })
  }
}

/**
 * @param {Object} opts Freeze options
 * @param {number} [opts.height] Until height is not be reached
 * @param {number} [opts.timestamp] Until timestamp not be reached (in seconds)
 * @param {number} [opts.fromNow] Freeze for given number in seconds
 * @return {Promise}
 */
Coin.prototype.freeze = Coin._createMethod('freeze', 'freezeCoins', true)

/**
 * @return {Promise}
 */
Coin.prototype.unfreeze = Coin._createMethod('unfreeze', 'unfreezeCoins')

/**
 * @return {Promise.<boolean>}
 */
Coin.prototype.isValid = Coin._createMethod('isValid', 'isCoinValid')

/**
 * @return {Promise.<boolean>}
 */
Coin.prototype.isAvailable =
  Coin._createMethod('isAvailable', 'isCoinAvailable')

/**
 * @return {Promise.<boolean>}
 */
Coin.prototype.isSpent = Coin._createMethod('isSpent', 'isCoinSpent')

/**
 * @return {Promise.<boolean>}
 */
Coin.prototype.isFrozen = Coin._createMethod('isFrozen', 'isCoinFrozen')

/**
 * @return {Promise.<ColorValue>}
 */
Coin.prototype.getColorValue =
  Coin._createMethod('getColorValue', 'getCoinColorValue')

/**
 * @return {Coin~RawCoin}
 */
Coin.prototype.toRawCoin = function () {
  return {
    txid: this.txid,
    oidx: this.oidx,
    value: this.value,
    script: this.script
  }
}

/**
 * @return {string}
 */
Coin.prototype.toString = function () {
  return this.txid + ':' + this.oidx
}

module.exports = Coin
