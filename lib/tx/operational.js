'use strict'

var inherits = require('util').inherits
var cclib = require('coloredcoinjs-lib')

/**
 * @class OperationalTx
 * @extends coloredcoinjs-lib.tx.Operational
 * @param {Wallet} wallet
 */
function OperationalTx (wallet) {
  cclib.OperationalTx.call(this)

  this._wallet = wallet
}

inherits(OperationalTx, cclib.tx.Operational)

/**
 * @param {coloredcoinjs-lib.ColorValue} cvalue
 * @param {{estimateRequiredFee: function}} [feeEstimator]
 * @return {Promise.<{coins: Coin[], total: coloredcoinjs-lib.ColorValue}>}
 */
OperationalTx.prototype.selectCoins = function (colorValue, feeEstimator) {
  var self = this
  return Promise.try(function () {
    var cdef = colorValue.getColorDefinition()

    if (!colorValue.isUncolored() && feeEstimator !== null) {
      throw new Error('FeeEstimator incompatible with colored value')
    }

    return self._wallet.getAllAddresses(cdef)
      .then(function (addresses) {
        var coinQuery = self._wallet.getCoinQuery()
        coinQuery = coinQuery.onlyColoredAs(cdef)
        coinQuery = coinQuery.onlyColoredAs(addresses)

        if (self._wallet.canSpendUnconfirmedCoins) {
          coinQuery = coinQuery.includeUnconfirmed()
        }

        return coinQuery.getCoins()
          .then(function (coins) {
            var data = {
              coins: [],
              total: new cclib.ColorValue(cdef, 0)
            }

            var requiredSum = colorValue.clone()
            if (feeEstimator !== null) {
              requiredSum = requiredSum.plus(
                feeEstimator.estimateRequiredFee({inputs: coins.length}))
            }

            return Promise.map(coins, function (coin) {
              if (data.total.getValue() >= requiredSum.getValue()) {
                return
              }

              return coin.getColorValue()
                .then(function (coinColorValue) {
                  data.coins.push(coin)
                  data.total = data.total.plus(coinColorValue)
                })
            }, {concurrency: 1})
            .then(function () {
              if (data.total.getValue() >= requiredSum.getValue()) {
                return data
              }

              var required = requiredSum.getValue()
              var selected = data.total.getValue()
              throw new Error('Insufficient funds, ' + required + ' requested, ' + selected + ' found')
            })
          })
      })
  })
}

/**
 * @param {coloredcoinjs-lib.definitions.Interface} cdef
 * @return {Promise.<?string>}
 */
OperationalTx.prototype.getChangeAddress = function (cdef) {
  return this._wallet.getSomeAddress(cdef)
}

module.exports = OperationalTx
