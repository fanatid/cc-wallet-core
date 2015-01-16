var _ = require('lodash')
var Q = require('q')

var util = require('./cclib').util
var verify = require('./verify')


/**
 * @external events
 * @see {@link http://nodejs.org/api/events.html Built-in node.js events module}
 */

/**
 * @member {function} external:events.EventEmitter
 */

/**
 * @external Q
 * @see {@link https://github.com/kriskowal/q Q on github}
 */

/**
 * @member {function} external:Q.Promise
 */

/**
 * @class OrderedMap
 */
function OrderedMap() {
  this._keys = {}
  this._vals = []
}

/**
 * @param {string} key
 * @param {?} val
 */
OrderedMap.prototype.add = function (key, val) {
  if (_.isUndefined(this._keys[key])) {
    this._keys[key] = true
    this._vals.push(val)
  }
}

/**
 * @return {string[]}
 */
OrderedMap.prototype.getKeys = function () { return _.keys(this._keys) }

/**
 * @return {string[]}
 */
OrderedMap.prototype.getVals = function () { return this._vals }


/**
 * @event SyncMixin#syncStart
 */

/**
 * @event SyncMixin#syncStop
 */

/**
 * @mixin SyncMixin
 */
function SyncMixin() {
  var self = this
  var syncCount = 0

  /**
   * @return {boolean}
   */
  self.isSyncing = function () {
    return syncCount > 0
  }

  /**
   * @private
   */
  self._syncEnter = function () {
    syncCount += 1
    if (syncCount === 1) { self.emit('syncStart') }
  }

  /**
   * @private
   */
  self._syncExit = function () {
    syncCount -= 1
    if (syncCount === 0) { self.emit('syncStop') }
  }
}


/**
 * @param {Object} [enumObj]
 * @param {Object} obj
 * @return {Object}
 */
function updateEnum(enumObj, obj) {
  var props = _.chain(obj)
    .map(function (value, name) {
      if (_.isObject(value)) {
        Object.freeze(value)
      }

      var methodName = 'is' + name[0].toUpperCase() + name.slice(1)
      var method = function (thing) {
        if (_.isArray(value)) {
          return value.indexOf(thing) !== -1
        }

        return thing === value
      }

      return [
        [name, {enumerable: true, value: value}],
        [methodName, {enumerable: true, value: method}]
      ]
    })
    .flatten(true)
    .zipObject()
    .value()

  return Object.defineProperties(enumObj, props)
}

/**
 * @param {Object} obj
 * @return {Object}
 */
function createEnum(obj) {
  return updateEnum({}, obj)
}


/**
 * @callback createCoins~callback
 * @param {?Error} error
 */

/**
 * @param {Wallet} wallet Wallet for create, transfrom and sending tx
 * @param {Object} opts Issue coins options
 * @param {AssetDefinition} opts.assetdef Asset definition of new coins
 * @param {number} opts.count How many coins needed
 * @param {number} [opts.totalAmount] Value in satoshi for all coins
 * @param {number} [opts.coinValue] Value in satoshi for every coin, preferred
 *     value than totalAmount
 * @param {string} opt.seed Seed in hex format
 * @param {createCoins~callback} cb Callback function
 */
function createCoins(wallet, opts, cb) {
  verify.Wallet(wallet)
  verify.object(opts)
  verify.AssetDefinition(opts.assetdef)
  verify.number(opts.count)
  if (_.isUndefined(opts.coinValue)) {
    verify.number(opts.totalAmount)
    opts.coinValue = ~~(opts.totalAmount / opts.count)
  }
  verify.number(opts.coinValue)
  verify.string(opts.seed)
  verify.function(cb)

  var address = wallet.getSomeAddress(opts.assetdef)
  var targets = _.range(opts.count).map(function () {
    return {value: opts.coinValue, address: address}
  })

  Q.ninvoke(wallet, 'createTx', opts.assetdef, targets).then(function (tx) {
    return Q.ninvoke(wallet, 'transformTx', tx, 'signed', {seedHex: opts.seed})

  }).then(function (tx) {
    return Q.ninvoke(wallet, 'sendTx', tx)

  }).done(
    function () { cb(null) },
    function (error) { cb(error) }
  )
}


module.exports = _.extend(util, {
  OrderedMap: OrderedMap,
  SyncMixin: SyncMixin,
  enum: {
    create: createEnum,
    update: updateEnum
  },
  createCoins: createCoins
})
