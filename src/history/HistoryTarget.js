var bitcoin = require('../cclib').bitcoin
var verify = require('../verify')


/**
 * @class HistoryTarget
 *
 * @param {AssetValue} assetValue
 * @param {string} script
 * @param {Object} network
 */
function HistoryTarget(assetValue, script, network) {
  verify.hexString(script)
  verify.AssetValue(assetValue)
  verify.bitcoinNetwork(network)

  this.script = script
  this.assetValue = assetValue
  script = bitcoin.Script.fromHex(script)
  this.addresses = bitcoin.getAddressesFromOutputScript(script, network)
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
