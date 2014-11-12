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

  this.wallet = wallet

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
CoinQuery.prototype.clone = function() {
  var newCoinQuery = new CoinQuery(this.wallet, _.cloneDeep(this.query))
  return newCoinQuery
}

/**
 * @param {(ColorDefinition|ColorDefinition[])} colors
 * @return {CoinQuery}
 */
CoinQuery.prototype.onlyColoredAs = function(colors) {
  if (!_.isArray(colors))
    colors = [colors]

  verify.array(colors)
  colors.forEach(verify.ColorDefinition)

  colors = colors.map(function(cd) { return cd.getColorId() })
  var query = _.extend(_.cloneDeep(this.query), { onlyColoredAs: colors })
  return new CoinQuery(this.wallet, query)
}

/**
 * @param {(string|string[])} data
 * @return {CoinQuery}
 */
CoinQuery.prototype.onlyAddresses = function(addresses) {
  if (!_.isArray(addresses))
    addresses = [addresses]

  verify.array(addresses)
  addresses.forEach(verify.string)

  var query = _.extend(_.cloneDeep(this.query), { onlyAddresses: addresses })
  return new CoinQuery(this.wallet, query)
}

/**
 * @return {CoinQuery}
 */
CoinQuery.prototype.includeSpent = function() {
  var query = _.extend(_.cloneDeep(this.query), { includeSpent: true })
  return new CoinQuery(this.wallet, query)
}

/**
 * @return {CoinQuery}
 */
CoinQuery.prototype.onlySpent = function() {
  var query = _.extend(_.cloneDeep(this.query), { onlySpent: true })
  return new CoinQuery(this.wallet, query)
}

/**
 * @return {CoinQuery}
 */
CoinQuery.prototype.includeUnconfirmed = function() {
  var query = _.extend(_.cloneDeep(this.query), { includeUnconfirmed: true })
  return new CoinQuery(this.wallet, query)
}

/**
 * @return {CoinQuery}
 */
CoinQuery.prototype.onlyUnconfirmed = function() {
  var query = _.extend(_.cloneDeep(this.query), { onlyUnconfirmed: true })
  return new CoinQuery(this.wallet, query)
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
CoinQuery.prototype.getCoins = function(cb) {
  verify.function(cb)

  var self = this

  Q.fcall(function() {
    /** select coins for filtered addresses */
    var assetdefs = self.wallet.getAllAssetDefinitions()
    var addresses = _.flatten(
      assetdefs.map(function(assetdef) { return self.wallet.getAllAddresses(assetdef) }))
    if (self.query.onlyAddresses !== null)
      addresses = addresses.filter(function(address) { return self.query.onlyAddresses.indexOf(address) !== -1 })

    var coinManager = self.wallet.getCoinManager()
    var coins = _.flatten(
      addresses.map(function(address) { return coinManager.getCoinsForAddress(address) }))

    /** remove duplicate coins */
    coins = _.uniq(coins, function(coin) { return coin.toString() })

    /** filter include/only spent coins */
    if (self.query.onlySpent)
      coins = coins.filter(function(coin) { return coin.isSpent() })
    if (!self.query.includeSpent && !self.query.onlySpent)
      coins = coins.filter(function(coin) { return !coin.isSpent() })

    var result = []
    var promise = Q()

    coins.forEach(function(coin) {
      /** filter include/only unconfirmed coins */
      var isConfirmed = coin.isConfirmed()
      if (self.query.onlyUnconfirmed && isConfirmed)
        return

      if (!self.query.onlyUnconfirmed && !self.query.includeUnconfirmed && !isConfirmed)
        return

      /** filter color */
      if (self.query.onlyColoredAs === null)
        return result.push(coin)

      promise = promise.then(function() {
        return Q.ninvoke(coin, 'getMainColorValue').then(function(colorValue) {
          if (self.query.onlyColoredAs.indexOf(colorValue.getColorId()) !== -1)
            result.push(coin)
        })
      })
    })

    return promise.then(function() { return result })

  }).then(function(coins) {
    return coins.filter(function(coin) { return !_.isUndefined(coin) })

  }).done(function(coins) { cb(null, new CoinList(coins)) }, function(error) { cb(error) })
}


module.exports = CoinQuery
