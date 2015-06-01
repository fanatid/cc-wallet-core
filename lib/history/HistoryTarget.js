var bitcoin = require('../cclib').bitcoin

/**
 * @class HistoryTarget
 *
 * @param {AssetValue} assetValue
 * @param {string} script
 * @param {Object} network One of coloredcoinjs-lib.bitcoin.networks
 */
function HistoryTarget (assetValue, script, network) {
  this.assetValue = assetValue
  this.script = script
  script = bitcoin.Script.fromHex(script)
  this.addresses = bitcoin.util.getAddressesFromScript(script, network)
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
