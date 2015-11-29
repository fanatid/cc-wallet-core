var _ = require('lodash')
var Q = require('q')
var cclib = require('coloredcoinjs-lib')

var errors = require('../errors')

function isWalletState (walletState) {
  return walletState instanceof require('../wallet/WalletState')
}

/** @todo Remove Address from rawCoin, because it can be reached via script */

/**
 * @typedef {Object} Coin~RawCoin
 * @property {string} txId
 * @property {number} outIndex
 * @property {number} value
 * @property {string} script
 * @property {string} address
 */

/**
 * @typedef {Object} Coin~MethodsManager
 * @property {WalletStateManager#freezeCoins} [freezeCoins]
 * @property {WalletStateManager#unfreezeCoins} [unfreezeCoins]
 * @property {(boolean|WalletStateManager#isSpent)} [isSpent]
 * @property {(boolean|WalletStateManager#isValid)} [isValid]
 * @property {(boolean|WalletStateManager#isAvailable)} [isAvailable]
 * @property {(boolean|WalletStateManager#isFrozen)} [isFrozen]
 * @property {(cclib.ColorValue|WalletStateManager#getCoinMainColorValue)} [getMainColorValue]
 */

function booleanPropTest (obj, fName) {
  if (_.isBoolean(obj[fName])) {
    obj[fName] = _.constant(obj[fName])
  }
}

function colorValuePropTest (obj, fName) {
  if (obj[fName] instanceof cclib.ColorValue) {
    var value = obj[fName]
    obj[fName] = function () { _.last(arguments)(null, value) }
  }
}

/**
 * Represent tx output and provide some useful methods
 *
 * @class Coin
 * @param {Coin~RawCoin} rawCoin
 * @param {(Wallet|WalletStateManager|Coin~MethodsManager)} [methodsManager]
 */
function Coin (rawCoin, methodsManager) {
  if (_.isUndefined(methodsManager)) {
    methodsManager = {}
  }
  if (_.isFunction(methodsManager.getStateManager)) {
    methodsManager = methodsManager.getStateManager()
  }
  // functionPropTest(methodsManager, 'freezeCoins')
  // functionPropTest(methodsManager, 'unfreezeCoins')
  booleanPropTest(methodsManager, 'isSpent')
  booleanPropTest(methodsManager, 'isValid')
  booleanPropTest(methodsManager, 'isAvailable')
  booleanPropTest(methodsManager, 'isFrozen')
  colorValuePropTest(methodsManager, 'getCoinMainColorValue')

  // init coin
  var self = this

  self._rawCoin = _.clone(rawCoin)
  self._methodsManager = methodsManager
  self._cachedProps = {}

  _.forEach(rawCoin, function (value, key) {
    Object.defineProperty(self, key, {
      enumerable: true,
      value: value
    })
  })
}

/**
 * @return {Coin~RawCoin}
 */
Coin.prototype.toRawCoin = function () {
  return _.clone(this._rawCoin)
}

/**
 * @return {string}
 */
Coin.prototype.toString = function () {
  return this.txId + ':' + this.outIndex
}

/**
 * @private
 * @param {string} methodName
 * @return {NotImplementedError}
 */
Coin.prototype._createNotImplementedError = function (methodName) {
  var msg = methodName + ' not implemented for coin ' + this
  return new errors.NotImplementedError(msg)
}

/**
 * @callback Coin~freezeUnfreezeCallback
 * @param {?Error} error
 */

/**
 * @param {Object} opts Freeze options
 * @param {number} [opts.height] Freeze until height is not be reached
 * @param {number} [opts.timestamp] Freeze until timestamp is not be reached
 * @param {number} [opts.fromNow] As timestamp that equal (Date.now() + fromNow)
 * @param {Coin~freezeUnfreezeCallback} cb
 */
Coin.prototype.freeze = function (opts, cb) {
  if (_.isUndefined(this._methodsManager.freezeCoins)) {
    return cb(this._createNotImplementedError('methodsManager.freeze'))
  }

  this._methodsManager.freezeCoins([this.toRawCoin()], opts, cb)
}

/**
 * @param {Coin~freezeUnfreezeCallback} cb
 */
Coin.prototype.unfreeze = function (cb) {
  if (_.isUndefined(this._methodsManager.unfreezeCoins)) {
    return cb(this._createNotImplementedError('methodsManager.unfreeze'))
  }

  this._methodsManager.unfreezeCoins([this.toRawCoin()], cb)
}

/**
 * @private
 * @param {string} methodName
 * @param {WalletState} [walletState]
 * @param {Object} [opts]
 * @param {boolean} [opts.cache=true]
 * @return {boolean}
 * @throws {NotImplementedError}
 */
Coin.prototype._booleanPropMethod = function (methodName, walletState, opts) {
  // methodName, !walletState, undefined -> methodName, undefined, !walletState
  if (!isWalletState(walletState) && _.isUndefined(opts)) {
    opts = walletState
    walletState = undefined
  }
  opts = _.extend({cache: true}, opts)

  if (opts.cache === false || _.isUndefined(this._cachedProps[methodName])) {
    if (_.isUndefined(this._methodsManager[methodName])) {
      throw this._createNotImplementedError('methodsManager.' + methodName)
    }

    this._cachedProps[methodName] = this._methodsManager[methodName](this.toRawCoin(), walletState)
  }

  return this._cachedProps[methodName]
}

/**
 * @param {WalletState} [walletState]
 * @param {Object} [opts]
 * @param {boolean} [opts.cache=true]
 * @return {boolean}
 */
Coin.prototype.isSpent = function (walletState, opts) {
  return this._booleanPropMethod('isCoinSpent', walletState, opts)
}

/**
 * @param {WalletState} [walletState]
 * @param {Object} [opts]
 * @param {boolean} [opts.cache=true]
 * @return {boolean}
 */
Coin.prototype.isValid = function (walletState, opts) {
  return this._booleanPropMethod('isCoinValid', walletState, opts)
}

/**
 * @param {WalletState} [walletState]
 * @param {Object} [opts]
 * @param {boolean} [opts.cache=true]
 * @return {boolean}
 */
Coin.prototype.isAvailable = function (walletState, opts) {
  return this._booleanPropMethod('isCoinAvailable', walletState, opts)
}

/**
 * @param {WalletState} [walletState]
 * @param {Object} [opts]
 * @param {boolean} [opts.cache=true]
 * @return {boolean}
 */
Coin.prototype.isFrozen = function (walletState, opts) {
  return this._booleanPropMethod('isCoinFrozen', walletState, opts)
}

/**
 * @private
 * @param {string} methodName
 * @param {?cclib.ColorDefinition} colordef
 * @param {WalletState} [walletState]
 * @param {Object} [opts]
 * @param {boolean} [opts.cache=true]
 * @return {cclib.ColorValue}
 */
Coin.prototype._colorValuePropMethod = function (methodName, colordef, walletState, opts, cb) {
  // ..., function, undefined, undefined    -> ..., undefined, undefined, function
  // ..., undefined, function, undefined    -> ..., undefined, undefined, function
  // ..., !walletstate, function, undefined -> ..., undefined, !walletstate, function
  // ..., walletstate, function, undefined  -> ..., walletstate, undefined, function
  if (_.isFunction(walletState) && _.isUndefined(opts) && _.isUndefined(cb)) {
    cb = walletState
    walletState = undefined
  } else if (_.isUndefined(walletState) && _.isFunction(opts) && _.isUndefined(cb)) {
    cb = opts
    opts = undefined
  } else if (!isWalletState(walletState) && _.isFunction(opts) && _.isUndefined(cb)) {
    cb = opts
    opts = walletState
    walletState = undefined
  } else if (isWalletState(walletState) && _.isFunction(opts) && _.isUndefined(cb)) {
    cb = opts
    opts = undefined
  }
  opts = _.extend({cache: true}, opts)

  if (opts.cache === false || _.isUndefined(this._cachedProps[methodName])) {
    if (_.isUndefined(this._methodsManager[methodName])) {
      this._cachedProps[methodName] = Promise.reject(this._createNotImplementedError('methodsManager.' + methodName))
    } else {
      var args = [this.toRawCoin(), colordef, walletState]
      if (colordef === null) {
        args.splice(1, 1)
      }

      var manager = this._methodsManager
      this._cachedProps[methodName] = Q.npost(manager, methodName, args)
    }
  }

  this._cachedProps[methodName]
    .then(function (colorValue) { cb(null, colorValue) },
          function (error) { cb(error) }
  )
}

/**
 * @param {WalletState} [walletState]
 * @param {Object} [opts]
 * @param {boolean} [opts.cache=true]
 * @return {cclib.ColorValue} cb
 */
Coin.prototype.getMainColorValue = function (walletState, opts, cb) {
  return this._colorValuePropMethod('getCoinMainColorValue', null, walletState, opts, cb)
}

module.exports = Coin
