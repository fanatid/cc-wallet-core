var _ = require('lodash')

var verify = require('../verify')


/**
 * @class Coin
 * @param {CoinManager} coinManager
 * @param {CoinStorageRecord} rawCoin
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
 * @return {CoinStorageRecord}
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
 * {@link CoinManager.isCoinSpent}
 */
Coin.prototype.isSpent = function() {
  if (!_.isUndefined(this._isSpent))
    return this._isSpent

  return this.coinManager.isCoinSpent(this)
}

/**
 * {@link CoinManager.isCoinValid}
 */
Coin.prototype.isValid = function() {
  if (!_.isUndefined(this._isValid))
    return this._isValid

  return this.coinManager.isCoinValid(this)
}

/**
 * {@link CoinManager.isCoinAvailable}
 */
Coin.prototype.isAvailable = function() {
  if (!_.isUndefined(this._isAvailable))
    return this._isAvailable

  return this.coinManager.isCoinAvailable(this)
}

/**
 * {@link CoinManager.getCoinColorValue}
 */
Coin.prototype.getColorValue = function(colorDefinition, cb) {
  this.coinManager.getCoinColorValue(this, colorDefinition, cb)
}

/**
 * {@link CoinManager.getCoinMainColorValue}
 */
Coin.prototype.getMainColorValue = function (cb) {
  this.coinManager.getCoinMainColorValue(this, cb)
}

/**
 * @return {string}
 */
Coin.prototype.toString = function() {
  return this.txId + ':' + this.outIndex
}


module.exports = Coin
