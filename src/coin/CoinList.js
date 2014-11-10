var _ = require('lodash')
var Q = require('q')

var verify = require('../verify')


/**
 * @class CoinList
 *
 * @param {Coin[]}
 */
function CoinList(coins) {
  verify.array(coins)
  coins.forEach(verify.Coin)

  this.coins = coins
  this.coins.forEach(function(coin, index) { this[index] = coin }.bind(this))

  this.length = this.coins.length
}

/**
 * @return {Coin[]}
 */
CoinList.prototype.getCoins = function() {
  return this.coins
}

/**
 * @callback CoinList~getTotalValue
 * @param {?Error} error
 * @param {ColorValue[]} colorValues
 */

/**
 * @param {CoinList~getTotalValue} cb
 */
CoinList.prototype.getTotalValue = function(cb) {
  verify.function(cb)

  var self = this
  var dColorValues = {}

  var promises = self.coins.map(function(coin) {
    return Q.ninvoke(coin, 'getMainColorValue').then(function(colorValue) {
      var colorId = colorValue.getColorId()
      if (_.isUndefined(dColorValues[colorId]))
        dColorValues[colorId] = colorValue
      else
        dColorValues[colorId] = dColorValues[colorId].plus(colorValue)
    })
  })

  Q.all(promises).then(function() {
    return _.values(dColorValues)

  }).done(function(result) { cb(null, result) }, function(error) { cb(error) })
}


module.exports = CoinList
