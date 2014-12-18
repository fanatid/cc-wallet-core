var _ = require('lodash')
var Q = require('q')

var CoinList = require('./CoinList')
var verify = require('../verify')


/**
 * @class CoinQuery
 *
 * @param {Wallet} wallet
 * @param {Object} [query]
 * @param {ColorDefinition[]} [query.onlyColoredAs=null]
 * @param {string[]} [query.onlyAddresses=null]
 * @param {boolean} [query.includeSpent=false]
 * @param {boolean} [query.onlySpent=false]
 * @param {boolean} [query.includeUnconfirmed=false]
 * @param {boolean} [query.onlyUnconfirmed=false]
 */
function CoinQuery(wallet, query) {
  verify.Wallet(wallet)

  this._wallet = wallet

  this.query = _.extend({
    onlyColoredAs: null,
    onlyAddresses: null,

    includeSpent: false,
    onlySpent: false,

    includeUnconfirmed: false,
    onlyUnconfirmed: false
  }, query)
}

/**
 * @return {CoinQuery}
 */
CoinQuery.prototype.clone = function () {
  var newCoinQuery = new CoinQuery(this._wallet, _.cloneDeep(this.query))
  return newCoinQuery
}

/**
 * @param {(ColorDefinition|ColorDefinition[])} colors
 * @return {CoinQuery}
 */
CoinQuery.prototype.onlyColoredAs = function (colors) {
  if (!_.isArray(colors)) {
    colors = [colors]
  }

  verify.array(colors)
  colors.forEach(verify.ColorDefinition)

  colors = colors.map(function (cd) { return cd.getColorId() })
  var query = _.extend(_.cloneDeep(this.query), {onlyColoredAs: colors})
  return new CoinQuery(this._wallet, query)
}

/**
 * @param {(string|string[])} addresses
 * @return {CoinQuery}
 */
CoinQuery.prototype.onlyAddresses = function (addresses) {
  if (!_.isArray(addresses)) {
    addresses = [addresses]
  }

  verify.array(addresses)
  addresses.forEach(verify.string)

  var query = _.extend(_.cloneDeep(this.query), {onlyAddresses: addresses})
  return new CoinQuery(this._wallet, query)
}

/**
 * @return {CoinQuery}
 */
CoinQuery.prototype.includeSpent = function () {
  var query = _.extend(_.cloneDeep(this.query), {includeSpent: true})
  return new CoinQuery(this._wallet, query)
}

/**
 * @return {CoinQuery}
 */
CoinQuery.prototype.onlySpent = function () {
  var query = _.extend(_.cloneDeep(this.query), {onlySpent: true})
  return new CoinQuery(this._wallet, query)
}

/**
 * @return {CoinQuery}
 */
CoinQuery.prototype.includeUnconfirmed = function () {
  var query = _.extend(_.cloneDeep(this.query), {includeUnconfirmed: true})
  return new CoinQuery(this._wallet, query)
}

/**
 * @return {CoinQuery}
 */
CoinQuery.prototype.onlyUnconfirmed = function () {
  var query = _.extend(_.cloneDeep(this.query), {onlyUnconfirmed: true})
  return new CoinQuery(this._wallet, query)
}

/**
 * @callback CoinQuery~getCoins
 * @param {?Error} error
 * @param {CoinList} coinList
 */

/**
 * Select coins and return CoinList via cb
 *
 * @param {CoinQuery~getCoins} cb
 */
CoinQuery.prototype.getCoins = function (cb) {
  verify.function(cb)

  var self = this

  Q.fcall(function () {
    var coins
    if (self.query.onlyAddresses === null) {
      coins = self._wallet.getStateManager().getCoins()

    } else {
      coins = self._wallet.getStateManager().getCoins(self.query.onlyAddresses)

    }

    var promises = coins.map(function (coin) {
      // return if txStatus is invalid or unknow
      if (!coin.isValid()) {
        return
      }

      // filter include/only spent coins
      if (self.query.onlySpent && !coin.isSpent()) {
        return
      }
      if (!self.query.onlySpent && !self.query.includeSpent && coin.isSpent()) {
        return
      }

      // filter include/only unconfirmed coins
      if (self.query.onlyUnconfirmed && coin.isAvailable()) {
        return
      }
      if (!self.query.onlyUnconfirmed && !self.query.includeUnconfirmed && !coin.isAvailable()) {
        return
      }

      // filter color
      if (self.query.onlyColoredAs === null) {
        return coin
      }

      return Q.ninvoke(coin, 'getMainColorValue').then(function (colorValue) {
        if (self.query.onlyColoredAs.indexOf(colorValue.getColorId()) !== -1) {
          return coin
        }
      })
    })

    return Q.all(promises).then(function (result) { return _.filter(result) })

  }).done(function (coins) { cb(null, new CoinList(coins)) }, function (error) { cb(error) })
}


module.exports = CoinQuery
