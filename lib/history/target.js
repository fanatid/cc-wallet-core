'use strict'

var bitcoinUtil = require('../util/bitcoin')

/**
 * @class HistoryTarget
 * @param {AssetValue} assetValue
 * @param {string} script
 * @param {Object} network
 */
function HistoryTarget (assetValue, script, network) {
  this._assetValue = assetValue
  this._script = script
  this._addresses = bitcoinUtil.script2addresses(script, network)
}

/**
 * @return {AssetValue}
 */
HistoryTarget.prototype.getAssetValue = function () {
  return this._assetValue
}

/**
 * @return {AssetDefinition}
 */
HistoryTarget.prototype.getAsset = function () {
  return this._assetValue.getAsset()
}

/**
 * @return {number}
 */
HistoryTarget.prototype.getValue = function () {
  return this._assetValue.getValue()
}

/**
 * @return {string}
 */
HistoryTarget.prototype.getScript = function () {
  return this._script
}

/**
 * @return {string[]}
 */
HistoryTarget.prototype.getAddresses = function () {
  return this._addresses
}

module.exports = HistoryTarget
