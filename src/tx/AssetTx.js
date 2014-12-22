var _ = require('lodash')

var OperationalTx = require('./OperationalTx')
var cclib = require('../cclib')
var verify = require('../verify')


/**
 * Simple asset transaction, but now supports only 1 color in asset
 *
 * @class AssetTx
 *
 * @param {Wallet} wallet
 * @param {AssetTarget[]} [assetTargets]
 */
function AssetTx(wallet, assetTargets) {
  if (_.isUndefined(assetTargets)) {
    assetTargets = []
  }

  verify.Wallet(wallet)
  verify.array(assetTargets)
  assetTargets.forEach(verify.AssetTarget)

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
  verify.AssetTarget(target)
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
 * @throws {Error} Will throw an error if current transaction don't have targets
 */
AssetTx.prototype.isMonoAsset = function () {
  if (this.targets.length === 0) {
    throw new Error('asset targets not found')
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
 * @return {boolean}
 * @throws {Error} Will throw an error if current transaction don't have targets
 */
AssetTx.prototype.isMonoColor = function () {
  if (!this.isMonoAsset) {
    return false
  }

  var colorIds = this.targets[0].getAsset().getColorSet().getColorIds()
  var isMonoColor = colorIds.length === 1

  return isMonoColor
}

/**
 * @return {OperationalTx}
 * @throws {Error} Will throw an error if current transaction don't have targets or multi color
 */
AssetTx.prototype.makeOperationalTx = function () {
  // don't forget check targets.length > 0 if mono color check will be removed
  if (!this.isMonoColor()) {
    throw new Error('not supported multi color OperationalTx')
  }

  var assetdef = this.targets[0].getAsset()
  var colordef = this.wallet.cdManager.getByColorId(assetdef.getColorSet().getColorIds()[0])

  var colorTargets = this.targets.map(function (target) {
    var colorValue = new cclib.ColorValue(colordef, target.getValue())
    return new cclib.ColorTarget(target.getScript(), colorValue)
  })

  var operationalTx = new OperationalTx(this.wallet)
  operationalTx.addTargets(colorTargets)

  return operationalTx
}


module.exports = AssetTx
