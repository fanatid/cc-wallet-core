var util = require('util')
var Q = require('q')
var cclib = require('coloredcoinjs-lib')

var errors = require('../errors')

/**
 * @class OperationalTx
 * @extends cclib.tx.Operational
 *
 * @param {Wallet} wallet
 */
function OperationalTx (wallet) {
  cclib.tx.Operational.call(this)

  this.wallet = wallet
  this.targets = []
}

util.inherits(OperationalTx, cclib.tx.Operational)

/**
 * Add ColorTarget to current tx
 *
 * @param {cclib.ColorTarget} target
 */
OperationalTx.prototype.addTarget = function (target) {
  this.targets.push(target)
}

/**
 * Vectorized version of addTarget
 *
 * @param {cclib.ColorTarget[]} targets
 */
OperationalTx.prototype.addTargets = function (targets) {
  targets.forEach(this.addTarget.bind(this))
}

/**
 * Return ColorTargets of current transaction
 *
 * @return {cclib.ColorTarget[]}
 */
OperationalTx.prototype.getTargets = function () {
  return this.targets
}

/**
 * Return true if transaction represent 1 color
 *
 * @return {boolean}
 * @throws {ZeroArrayLengthError}
 */
OperationalTx.prototype.isMonoColor = function () {
  if (this.targets.length === 0) {
    throw new errors.ZeroArrayLengthError('ColorTargets')
  }

  var colorId = this.targets[0].getColorId()
  var isMonoColor = this.targets.every(function (target) { return target.getColorId() === colorId })

  return isMonoColor
}

/**
 * @param {number} txSize
 * @return {cclib.ColorValue}
 */
OperationalTx.prototype.getRequiredFee = function (txSize) {
  var feePerKb = this.wallet.getFeePerKb()
  var feeValue = Math.ceil(feePerKb * txSize / 1000)

  return new cclib.ColorValue(cclib.definitions.Manager.getUncolored(), feeValue)
}

/**
 * @return {cclib.ColorValue}
 */
OperationalTx.prototype.getDustThreshold = function () {
  var dustValue = this.wallet.getDustThreshold()
  return new cclib.ColorValue(cclib.definitions.Manager.getUncolored(), dustValue)
}

OperationalTx.prototype._getCoinsForColor = function (colordef) {
  var coinQuery = this.wallet.getCoinQuery()
  coinQuery = coinQuery.onlyColoredAs(colordef)
  coinQuery = coinQuery.onlyAddresses(this.wallet.getAllAddresses(colordef))
  if (this.wallet.canSpendUnconfirmedCoins()) {
    coinQuery = coinQuery.includeUnconfirmed()
  }
  return Q.ninvoke(coinQuery, 'getCoins')
}

/**
 * @callback OperationalTx~FeeEstimatorEstimateRequiredFee
 * @param {Object} extra
 * @param {number} [extra.inputs]
 * @param {number} [extra.outputs]
 * @param {number} [extra.bytes]
 * @return {number}
 */

/**
 * @typedef {Object} OperationalTx~FeeEstimator
 * @property {OperationalTx~FeeEstimatorEstimateRequiredFee} estimateRequiredFee
 */

/**
 * @typedef {Object} OperationalTx~AbstractRawCoin
 * @property {string} txId
 * @property {number} outIndex
 * @property {number} value
 * @property {string} script
 */

/**
 * @callback OperationalTx~AbstractCoinToRawCoin
 * @return {OperationalTx~AbstractRawCoin}
 */

/**
 * @typedef {Object} OperationalTx~AbstractCoin
 * @property {OperationalTx~AbstractCoinToRawCoin} toRawCoin
 */

/**
 * @typedef OperationalTx~selectCoinsResult
 * @property {OperationalTx~AbstractCoin[]} coins
 * @property {ColorValue} total
 */

/**
 * @param {cclib.ColorValue} colorValue
 * @param {OperationalTx~FeeEstimator} [feeEstimator]
 * @return {Promise<OperationalTx~selectCoinsResult>}
 */
OperationalTx.prototype.selectCoins = function (colorValue, feeEstimator) {
  var self = this

  var colordef
  return Q.fcall(function () {
    colordef = colorValue.getColorDefinition()

    if (!colorValue.isUncolored() && feeEstimator !== null) {
      throw new errors.ColoredFeeEstimatorError()
    }

    return self._getCoinsForColor(colordef)
  })
  .then(function (coinList) {
    var coins = coinList.getCoins()

    var selectedCoinsColorValue = new cclib.ColorValue(colordef, 0)
    var selectedCoins = []

    var requiredSum = colorValue.clone()
    if (feeEstimator !== null) {
      requiredSum = requiredSum.plus(feeEstimator.estimateRequiredFee({inputs: coins.length}))
    }

    var promise = Q.resolve()
    coins.forEach(function (coin) {
      promise = promise.then(function () {
        if (selectedCoinsColorValue.getValue() >= requiredSum.getValue()) {
          return
        }

        return Q.ninvoke(coin, 'getMainColorValue').then(function (coinColorValue) {
          selectedCoinsColorValue = selectedCoinsColorValue.plus(coinColorValue)
          selectedCoins.push(coin)
        })
      })
    })

    return promise
      .then(function () {
        if (selectedCoinsColorValue.getValue() >= requiredSum.getValue()) {
          return {coins: selectedCoins, total: selectedCoinsColorValue}
        }

        var required = requiredSum.getValue()
        var selected = selectedCoinsColorValue.getValue()
        throw new errors.InsufficientFundsError(required + ' requested, ' + selected + ' found')
      })
  })
}

/**
 * @param {cclib.ColorDefinition} colordef
 * @return {string}
 */
OperationalTx.prototype.getChangeAddress = function (colordef) {
  return this.wallet.getSomeAddress(colordef)
}

module.exports = OperationalTx
