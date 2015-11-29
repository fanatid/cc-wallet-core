var _ = require('lodash')
var Q = require('q')
var cclib = require('coloredcoinjs-lib')

var errors = require('../errors')
var OperationalTx = require('./OperationalTx')

/**
 * Simple asset transaction, but now supports only 1 color in asset
 *
 * @class AssetTx
 *
 * @param {Wallet} wallet
 * @param {AssetTarget[]} [assetTargets]
 */
function AssetTx (wallet, assetTargets) {
  if (_.isUndefined(assetTargets)) {
    assetTargets = []
  }

  this.wallet = wallet
  this.targets = []
  this.addTargets(assetTargets)
}

/**
 * Add AssetTarget to current tx
 *
 * @param {AssetTarget} target
 */
AssetTx.prototype.addTarget = function (target) {
  this.targets.push(target)
}

/**
 * Vectorized version of addTarget
 *
 * @param {AssetTarget[]} targets
 */
AssetTx.prototype.addTargets = function (targets) {
  targets.forEach(this.addTarget.bind(this))
}

/**
 * Return true if transaction represent 1 asset
 *
 * @return {boolean}
 */
AssetTx.prototype.isMonoAsset = function () {
  if (this.targets.length === 0) {
    throw new errors.ZeroArrayLengthError('AssetTx targets not found')
  }

  var assetId = this.targets[0].getAsset().getId()
  var isMonoAsset = this.targets.every(function (target) {
    return target.getAsset().getId() === assetId
  })

  return isMonoAsset
}

/**
 * Return true if transaction represent 1 color
 *
 * @return {Promise<boolean>}
 */
AssetTx.prototype.isMonoColor = function () {
  if (!this.isMonoAsset) {
    return Q.reject(false)
  }

  return this.targets[0].getAsset().getColorSet().getColorIds()
    .then(function (colorIds) {
      return colorIds.length === 1
    })
}

/**
 * @callback AssetTx~makeOperationalTxCallback
 * @param {?Error} error
 * @param {OperationalTx} operationalTx
 */

/**
 * @param {AssetTx~makeOperationalTxCallback} cb
 */
AssetTx.prototype.makeOperationalTx = function (cb) {
  var self = this

  if (!self.isMonoColor()) {
    throw new errors.MultiColorNotSupportedError('Attempt create OperationalTx from multi-color AssetTx')
  }

  if (self.targets.length === 0) {
    throw new errors.ZeroArrayLengthError('AssetTx targets not found')
  }

  var assetdef = self.targets[0].getAsset()
  Q.try(function () {
    return assetdef.getColorSet().getColorDefinitions()
  })
  .then(function (colordefs) {
    var colorTargets = self.targets.map(function (target) {
      var colorValue = new cclib.ColorValue(colordefs[0], target.getValue())
      return new cclib.ColorTarget(target.getScript(), colorValue)
    })

    var operationalTx = new OperationalTx(self.wallet)
    operationalTx.addTargets(colorTargets)

    return operationalTx
  })
  .then(function (opTx) { cb(null, opTx) },
        function (err) { cb(err) })
}

module.exports = AssetTx
