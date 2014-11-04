var verify = require('../verify')


/**
 * @class Coin
 * @param {CoinManager} coinManager
 * @param {CoinStorageRecord} rawCoin
 */
function Coin(coinManager, rawCoin) {
  verify.CoinManager(coinManager)
  verify.rawCoin(rawCoin)

  this.coinManager = coinManager

  this.txId = rawCoin.txId
  this.outIndex = rawCoin.outIndex
  this.value = rawCoin.value
  this.script = rawCoin.script
  this.address = rawCoin.address
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
  return this.coinManager.isCoinSpent(this)
}

/**
 * {@link CoinManager.isCoinConfirmed}
 */
Coin.prototype.isConfirmed = function() {
  return this.coinManager.isCoinConfirmed(this)
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
