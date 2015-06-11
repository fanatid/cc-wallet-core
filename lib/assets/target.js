/**
 * @class AssetTarget
 * @param {string} script
 * @param {AssetValue} avalue
 */
function AssetTarget (script, avalue) {
  this._script = script
  this._avalue = avalue
}

/**
 * @return {string}
 */
AssetTarget.prototype.getScript = function () {
  return this._script
}

/**
 * @return {AssetValue}
 */
AssetTarget.prototype.getAssetValue = function () {
  return this._avalue
}

/**
 * @return {AssetDefinition}
 */
AssetTarget.prototype.getAssetDefinition = function () {
  return this._avalue.getAsset()
}

/**
 * @return {number}
 */
AssetTarget.prototype.getValue = function () {
  return this._avalue.getValue()
}

module.exports = AssetTarget
