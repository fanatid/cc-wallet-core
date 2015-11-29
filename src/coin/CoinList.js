var timers = require('timers')
var _ = require('lodash')
var Q = require('q')

/**
 * @class CoinList
 * @param {Coin[]} coins
 */
function CoinList (coins) {
  this.coins = coins
  this.coins.forEach(function (coin, index) { this[index] = coin }.bind(this))

  this.length = this.coins.length

  this._getValuesCache = null
  this._getValuesPromise = null
}

/**
 * @return {Coin[]}
 */
CoinList.prototype.getCoins = function () {
  return this.coins
}

/**
 * @callback CoinList~getValuesCallback
 * @param {?Error} error
 * @param {Object} values
 * @param {cclib.ColorValue[]} values.total
 * @param {cclib.ColorValue[]} values.available
 * @param {cclib.ColorValue[]} values.unconfirmed
 */

/**
 * @param {CoinList~getValuesCallback} cb
 */
CoinList.prototype.getValues = function (cb) {
  var self = this
  if (self._getValuesCache !== null) {
    return timers.setImmediate(cb, null, self._getValuesCache)
  }

  if (self._getValuesPromise === null) {
    var values = {total: {}, available: {}, unconfirmed: {}}

    var promises = self.coins.map(function (coin) {
      return Q.ninvoke(coin, 'getMainColorValue')
        .then(function (colorValue) {
          var colorId = colorValue.getColorId()

          if (_.isUndefined(values.total[colorId])) {
            var zeroColorValue = colorValue.minus(colorValue)
            values.total[colorId] = zeroColorValue
            values.available[colorId] = zeroColorValue
            values.unconfirmed[colorId] = zeroColorValue
          }

          values.total[colorId] = values.total[colorId].plus(colorValue)

          if (coin.isAvailable()) {
            values.available[colorId] = values.available[colorId].plus(colorValue)
          } else {
            values.unconfirmed[colorId] = values.unconfirmed[colorId].plus(colorValue)
          }
        })
    })

    self._getValuesPromise = Q.all(promises)
      .then(function () {
        self._getValuesCache = {
          total: _.values(values.total),
          available: _.values(values.available),
          unconfirmed: _.values(values.unconfirmed)
        }

        return self._getValuesCache
      })
      .finally(function () { self._getValuesPromise = null })
  }

  self._getValuesPromise
    .then(function (values) { cb(null, values) }, function (error) { cb(error) })
}

/**
 * @callback CoinList~getTotalValueCallback
 * @param {?Error} error
 * @param {cclib.ColorValue[]} colorValues
 */

/**
 * @param {CoinList~getTotalValueCallback} cb
 */
CoinList.prototype.getTotalValue = function (cb) {
  Q.ninvoke(this, 'getValues')
    .then(function (values) { cb(null, values.total) }, function (error) { cb(error) })
}

module.exports = CoinList
