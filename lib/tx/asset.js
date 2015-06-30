'use strict'

var _ = require('lodash')
var cclib = require('coloredcoinjs-lib')

var OperationalTx = require('./operational')

/**
 * @class AssetTx
 * @param {Wallet} wallet
 * @param {AssetTarget[]} [assetTargets=[]]
 */
function AssetTx (wallet, assetTargets) {
  this._wallet = wallet
  this._targets = []

  this.addTargets(assetTargets || [])
}

/**
 * @param {AssetTarget} target
 */
AssetTx.prototype.addTarget = function (target) {
  this._targets.push(target)
}

/**
 * @param {AssetTarget[]} targets
 */
AssetTx.prototype.addTargets = function (targets) {
  targets.forEach(this.addTarget.bind(this))
}

/**
 * @return {boolean}
 */
AssetTx.prototype.isMonoAsset = function () {
  var aids = this._targets.map(function (target) {
    return target.getAssetDefinition().getId()
  })

  return _.uniq(aids).length <= 1
}

/**
 * @return {boolean}
 */
AssetTx.prototype.isMonoColor = function () {
  var acids = this._targets.map(function (target) {
    return target.getAssetDefinition().getColorSet().getColorIds()
  })

  return _.uniq(_.flatten(acids)) <= 1
}

/**
 * @return {coloredcoinjs-lib.tx.Operational}
 */
AssetTx.prototype.makeOperationalTx = function () {
  if (this._targets.length === 0) {
    throw new Error('AssetTx targets not found')
  }

  if (!this.isMonoColor()) {
    throw new Error('Attempt create OperationalTx from multi-color AssetTx')
  }

  var cid = this._targets[0].getAssetDefinition().getColorSet().getColorIds()[0]
  var cdef = this._wallet.colorDefinitionManager.get({id: cid})

  var colorTargets = this._targets.map(function (target) {
    var colorValue = new cclib.ColorValue(cdef, target.getValue())
    return new cclib.ColorTarget(target.getScript(), colorValue)
  })

  var operationalTx = new OperationalTx(this._wallet)
  operationalTx.addTargets(colorTargets)

  return operationalTx
}

module.exports = AssetTx
