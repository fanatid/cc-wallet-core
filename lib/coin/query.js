'use strict'

var _ = require('lodash')

/**
 * @typedef CoinQuery~RawQuery
 * @property {coloredcoinjs-lib.ColorDefinition[]} [query.onlyColoredAs=[]]
 * @property {string[]} [query.onlyAddresses=[]]
 * @property {boolean} [query.includeSpent=false]
 * @property {boolean} [query.onlySpent=false]
 * @property {boolean} [query.includeUnconfirmed=false]
 * @property {boolean} [query.onlyUnconfirmed=false]
 * @property {boolean} [query.includeFrozen=false]
 * @property {boolean} [query.onlyFrozen=false]
 */

/**
 * @class CoinQuery
 * @param {Wallet} wallet
 * @param {CoinQuery~RawQuery} [query]
 */
function CoinQuery (wallet, query) {
  this._wallet = wallet

  this._query = _.extend({
    onlyColoredAs: [],
    onlyAddresses: [],

    includeUnconfirmed: false,
    onlyUnconfirmed: false,

    includeSpent: false,
    onlySpent: false,

    includeFrozen: false,
    onlyFrozen: false
  }, query)
}

/**
 * @return {CoinQuery~RawQuery}
 */
CoinQuery.prototype.getQuery = function () {
  return _.cloneDeep(this._query)
}

/**
 * @return {Promise.<Coin[]>}
 */
CoinQuery.prototype.getCoins = function () {
  var query = _.cloneDeep(this._query)
  return this._wallet.coinManager.getCoins(query)
}

/**
 * @param {(coloredcoinjs-lib.ColorDefinition|coloredcoinjs-lib.ColorDefinition[])} cdefs
 * @return {CoinQuery}
 */
CoinQuery.prototype.onlyColoredAs = function (cdefs) {
  if (!_.isArray(cdefs)) {
    cdefs = [cdefs]
  }

  var cids = _.invoke(cdefs, 'getColorId')
  var query = _.defaults({onlyColoredAs: cids}, this._query)
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

  var query = _.defaults({onlyAddresses: addresses}, this._query)
  return new CoinQuery(this._wallet, query)
}

/**
 * @return {CoinQuery}
 */
CoinQuery.prototype.includeUnconfirmed = function () {
  var query = _.defaults({includeUnconfirmed: true}, this._query)
  return new CoinQuery(this._wallet, query)
}

/**
 * @return {CoinQuery}
 */
CoinQuery.prototype.onlyUnconfirmed = function () {
  var query = _.defaults({onlyUnconfirmed: true}, this._query)
  return new CoinQuery(this._wallet, query)
}

/**
 * @return {CoinQuery}
 */
CoinQuery.prototype.includeSpent = function () {
  var query = _.defaults({includeSpent: true}, this._query)
  return new CoinQuery(this._wallet, query)
}

/**
 * @return {CoinQuery}
 */
CoinQuery.prototype.onlySpent = function () {
  var query = _.defaults({onlySpent: true}, this._query)
  return new CoinQuery(this._wallet, query)
}

/**
 * @return {CoinQuery}
 */
CoinQuery.prototype.includeFrozen = function () {
  var query = _.extend({includeFrozen: true}, this._query)
  return new CoinQuery(this._wallet, query)
}

/**
 * @return {CoinQuery}
 */
CoinQuery.prototype.onlyFrozen = function () {
  var query = _.defaults({onlyFrozen: true}, this._query)
  return new CoinQuery(this._wallet, query)
}

module.exports = CoinQuery
