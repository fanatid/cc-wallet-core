var script2addresses = require('script2addresses')

/**
 * @class HistoryTarget
 *
 * @param {AssetValue} assetValue
 * @param {string} script
 * @param {Object} network
 */
function HistoryTarget (assetValue, script, network) {
  this.assetValue = assetValue
  this.script = script
  this.addresses = script2addresses(script, network).addresses
}

/**
 * @return {AssetValue}
 */
HistoryTarget.prototype.getAssetValue = function () {
  return this.assetValue
}

/**
 * @return {AssetDefinition}
 */
HistoryTarget.prototype.getAsset = function () {
  return this.getAssetValue().getAsset()
}

/**
 * @return {number}
 */
HistoryTarget.prototype.getValue = function () {
  return this.getAssetValue().getValue()
}

/**
 * @return {Buffer}
 */
HistoryTarget.prototype.getScript = function () {
  return this.script
}

/**
 * @return {string[]}
 */
HistoryTarget.prototype.getAddresses = function () {
  return this.addresses
}

module.exports = HistoryTarget
