var _ = require('lodash')

var verify = require('../verify')


/**
 * @typedef Coin~RawCoin
 * @property {string} txId
 * @property {number} outIndex
 * @property {number} value
 * @property {string} script
 * @property {string} address
 */

/**
 * @class Coin
 * @param {CoinManager} coinManager
 * @param {Coin~RawCoin} rawCoin
 * @param {Object} [opts]
 * @param {boolean} [opts.isSpent]
 * @param {boolean} [opts.isValid]
 * @param {boolean} [opts.isAvailable]
 */
function Coin(coinManager, rawCoin, opts) {
  verify.CoinManager(coinManager)
  verify.rawCoin(rawCoin)
  if (!_.isUndefined(opts)) {
    verify.object(opts)
    verify.boolean(opts.isSpent)
    verify.boolean(opts.isValid)
    verify.boolean(opts.isAvailable)
  }

  this.coinManager = coinManager

  this.txId = rawCoin.txId
  this.outIndex = rawCoin.outIndex
  this.value = rawCoin.value
  this.script = rawCoin.script
  this.address = rawCoin.address

  if (!_.isUndefined(opts)) {
    this._isSpent = opts.isSpent
    this._isValid = opts.isValid
    this._isAvailable = opts.isAvailable
  }
}

/**
 * @return {Coin~RawCoin}
 */
Coin.prototype.toRawCoin = function () {
  return {
    txId: this.txId,
    outIndex: this.outIndex,
    value: this.value,
    script: this.script,
    address: this.address
  }
}

/**
 * @return {boolean}
 */
Coin.prototype.isSpent = function () {
  if (!_.isUndefined(this._isSpent)) {
    return this._isSpent
  }

  return this.coinManager.isCoinSpent(this)
}

/**
 * @return {boolean}
 */
Coin.prototype.isValid = function () {
  if (!_.isUndefined(this._isValid)) {
    return this._isValid
  }

  return this.coinManager.isCoinValid(this)
}

/**
 * @return {boolean}
 */
Coin.prototype.isAvailable = function () {
  if (!_.isUndefined(this._isAvailable)) {
    return this._isAvailable
  }

  return this.coinManager.isCoinAvailable(this)
}

/**
 * @callback Coin~getColorValueCallback
 * @param {?Error} error
 * @param {external:coloredcoinjs-lib.ColorValue} colorValue
 */

/**
 * @param {external:coloredcoinjs-lib.ColorDefinition} colordef
 * @param {Coin~getColorValueCallback} cb
 */
Coin.prototype.getColorValue = function (colordef, cb) {
  this.coinManager._wallet.getStateManager().getCoinColorValue(this.toRawCoin(), colordef, cb)
}

/**
 * @param {Coin~getColorValueCallback} cb
 */
Coin.prototype.getMainColorValue = function (cb) {
  this.coinManager._wallet.getStateManager().getCoinMainColorValue(this.toRawCoin(), cb)
}

/**
 * @return {string}
 */
Coin.prototype.toString = function () {
  return this.txId + ':' + this.outIndex
}


module.exports = Coin
