var verify = require('../verify')


/**
 * @class AssetValue
 *
 * As ColorValue, just for asset
 *
 * @param {AssetDefinition} assetdef
 * @param {number} value
 */
function AssetValue(assetdef, value) {
  verify.AssetDefinition(assetdef)
  verify.number(value)

  this.assetdef = assetdef
  this.value = value
}

/**
 * @return {AssetDefinition}
 */
AssetValue.prototype.getAsset = function () {
  return this.assetdef
}

/**
 * @return {number}
 */
AssetValue.prototype.getValue = function () {
  return this.value
}


module.exports = AssetValue
