var cclib = require('coloredcoinjs-lib')
var errors = require('../errors')

/**
 * @typedef {Object} AssetDefinition~Desc
 * @param {string[]} monikers
 * @param {string[]} cdescs
 * @param {number} [unit=1] Power of 10, should be greater than 0
 */

/**
 * @class AssetDefinition
 * @param {coloredcoinjs-lib.definitions.Manager} cdmanager
 * @param {AssetDefinition~Desc} data
 * @throws {VerifyPowerError} If data.unit not power of 10
 */
function AssetDefinition (cdmanager, data) {
  if (data.cdescs.length !== 1) {
    throw new errors.MultiColorNotSupportedError('AssetDefinition.constructor')
  }

  var unit = data.unit === undefined ? 1 : data.unit
  if (Math.log(unit) / Math.LN10 % 1 !== 0) {
    throw new errors.VerifyPowerError(
      'data.unit should be power of 10 and greater than 0')
  }

  this._monikers = data.monikers
  this._colorSet = new cclib.ColorSet(cdmanager, data.cdescs)
  this._unit = unit
}

/**
 * @return {string}
 */
AssetDefinition.prototype.getId = function () {
  return this._colorSet.getColorHash()
}

/**
 * @return {string[]}
 */
AssetDefinition.prototype.getMonikers = function () {
  return this._monikers.slice(0)
}

/**
 * @return {coloredcoinjs-lib.ColorSet}
 */
AssetDefinition.prototype.getColorSet = function () {
  return this._colorSet
}

/**
 * @return {number}
 */
AssetDefinition.prototype.getUnit = function () {
  return this._unit
}

/**
 * @param {string} portion
 * @return {number}
 */
AssetDefinition.prototype.parseValue = function (portion) {
  var items = portion.split('.')

  var value = parseInt(items[0], 10) * this._unit
  if (!isNaN(value) && items[1] !== undefined) {
    var unitStringLength = this._unit.toString(10).length
    var zeroCentString = new Array(unitStringLength + 1).join('0')
    var centString = (items[1] + zeroCentString).slice(0, unitStringLength - 1)
    var centValue = parseInt(centString, 10)

    if (!isNaN(centValue)) {
      value += parseFloat(portion, 10) >= 0 ? centValue : -centValue
    }
  }

  return value
}

/**
 * @param {number} value
 * @return {string}
 */
AssetDefinition.prototype.formatValue = function (value) {
  var coinString = (~~(value / this._unit)).toString(10)
  if (coinString === '0' && value < 0) {
    coinString = '-' + coinString
  }

  var centString = Math.abs(value % this._unit).toString(10)
  var centStringLength = this._unit.toString(10).length - 1
  while (centString.length < centStringLength) {
    centString = '0' + centString
  }

  return coinString + '.' + centString
}

module.exports = AssetDefinition
