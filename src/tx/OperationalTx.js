var util = require('util')

var Q = require('q')

var cclib = require('../cclib')
var verify = require('../verify')


/**
 * @class OperationalTx
 * @extends cclib.OperationalTx
 *
 * @param {Wallet} wallet
 */
function OperationalTx(wallet) {
  verify.Wallet(wallet)

  cclib.OperationalTx.call(this)

  this.wallet = wallet
  this.targets = []
}

util.inherits(OperationalTx, cclib.OperationalTx)

/**
 * Add ColorTarget to current tx
 *
 * @param {ColorTarget} target
 */
OperationalTx.prototype.addTarget = function (target) {
  verify.ColorTarget(target)
  this.targets.push(target)
}

/**
 * Vectorized version of addTarget
 *
 * @param {ColorTarget[]} targets
 */
OperationalTx.prototype.addTargets = function (targets) {
  targets.forEach(this.addTarget.bind(this))
}

/**
 * Return ColorTargets of current transaction
 *
 * @return {ColorTarget[]}
 */
OperationalTx.prototype.getTargets = function () {
  return this.targets
}

/**
 * Return true if transaction represent 1 color
 *
 * @return {boolean}
 * @throws {Error} Will throw an error if current transaction don't have targets
 */
OperationalTx.prototype.isMonoColor = function () {
  if (this.targets.length === 0) {
    throw new Error('color targets not found')
  }

  var colorId = this.targets[0].getColorId()
  var isMonoColor = this.targets.every(function (target) { return target.getColorId() === colorId })

  return isMonoColor
}

/**
 * @param {number} txSize
 * @return {ColorValue}
 */
OperationalTx.prototype.getRequiredFee = function (txSize) {
  verify.number(txSize)

  var baseFee = 10000
  var feeValue = Math.ceil((txSize * baseFee) / 1000)

  return new cclib.ColorValue(new cclib.UncoloredColorDefinition(), feeValue)
}

/**
 * @return {ColorValue}
 */
OperationalTx.prototype.getDustThreshold = function () {
  return new cclib.ColorValue(new cclib.UncoloredColorDefinition(), 5500)
}

/**
 * @callback OperationalTx~selectCoins
 * @param {?Error}
 * @param {Coin[]} utxo
 * @param {ColorValue} utxoColorValue
 */

/*
 * @param {ColorValue}
 * @param {?Object} feeEstimator
 * @param {OperationalTx~selectCoins} cb
 */
OperationalTx.prototype.selectCoins = function (colorValue, feeEstimator, cb) {
  verify.ColorValue(colorValue)
  if (feeEstimator !== null) { verify.object(feeEstimator) }
  verify.function(cb)

  var self = this

  var colordef
  Q.fcall(function () {
    colordef = colorValue.getColorDefinition()

    if (!colorValue.isUncolored() && feeEstimator !== null) {
      throw new Error('feeEstimator can only be used with uncolored coins')
    }

    var coinQuery = self.wallet.getCoinQuery()
    coinQuery = coinQuery.onlyColoredAs(colordef)
    coinQuery = coinQuery.onlyAddresses(self.wallet.getAllAddresses(colordef))
    if (self.wallet.canSpendUnconfirmedCoins()) {
      coinQuery = coinQuery.includeUnconfirmed()
    }

    return Q.ninvoke(coinQuery, 'getCoins')

  }).then(function (coinList) {
    var coins = coinList.getCoins()

    var selectedCoinsColorValue = new cclib.ColorValue(colordef, 0)
    var selectedCoins = []

    var requiredSum = colorValue.clone()
    if (feeEstimator !== null) {
      requiredSum = requiredSum.plus(feeEstimator.estimateRequiredFee({extraTxIns: coins.length}))
    }

    var promise = Q()
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

    return promise.then(function () {
      if (selectedCoinsColorValue.getValue() >= requiredSum.getValue()) {
        return {coins: selectedCoins, value: selectedCoinsColorValue}
      }

      var required = requiredSum.getValue()
      var selected = selectedCoinsColorValue.getValue()
      throw new Error('not enough coins: ' + required + ' requested, ' + selected + ' found')
    })

  }).done(function (data) { cb(null, data.coins, data.value) }, function (error) { cb(error) })
}

/**
 * @param {ColorDefinition} colordef
 * @return {string}
 * @throws {Error} If targets not found or multi-color
 */
OperationalTx.prototype.getChangeAddress = function (colordef) {
  verify.ColorDefinition(colordef)

  return this.wallet.getSomeAddress(colordef)
}


module.exports = OperationalTx
