/**
 * @class AssetValue
 * @param {AssetDefinition} adef
 * @param {number} value
 */
function AssetValue (adef, value) {
  this._adef = adef
  this._value = value
}

/**
 * @return {AssetDefinition}
 */
AssetValue.prototype.getAssetDefinition = function () {
  return this._adef
}

/**
 * @return {number}
 */
AssetValue.prototype.getValue = function () {
  return this._value
}

module.exports = AssetValue
