var _ = require('lodash')

var cclib = require('../cclib')
var errors = require('../errors')
var verify = require('../verify')


/**
 * @typedef {Object} AssetDefinition~Desc
 * @param {string[]} monikers
 * @param {string[]} colorDescs
 * @param {number} [unit=1] Power of 10 and greater than 0
 */

/**
 * @class AssetDefinition
 * @param {external:coloredcoinjs-lib.ColorDefinitionManager} colorDefinitionManager
 * @param {AssetDefinition~Desc} data
 * @throws {VerifyPowerError} If data.unit not power of 10
 */
function AssetDefinition(colorDefinitionManager, data) {
  if (!data.colorDescs) {
    data.colorDescs = data.colorSchemes // upgrade from old version
  }

  verify.ColorDefinitionManager(colorDefinitionManager)
  verify.object(data)
  verify.array(data.monikers)
  data.monikers.forEach(verify.string)
  verify.array(data.colorDescs)
  data.colorDescs.forEach(verify.string)
  if (data.unit) { verify.number(data.unit) }

  if (data.colorDescs.length !== 1) {
    throw errors.MultiColorNotSupportedError('AssetDefinition.constructor')
  }

  data.unit = _.isUndefined(data.unit) ? 1 : data.unit
  if (Math.log(data.unit) / Math.LN10 % 1 !== 0) {
    throw new errors.VerifyPowerError('data.unit must be power of 10 and greater than 0')
  }

  this.monikers = data.monikers
  this.colorSet = new cclib.ColorSet(colorDefinitionManager, data.colorDescs)
  this.unit = data.unit
}

/**
 * @return {AssetDefinition~Desc}
 */
AssetDefinition.prototype.getData = function () {
  return {
    monikers: this.monikers,
    colorDescs: this.colorSet.getColorDescs(),
    unit: this.unit
  }
}

/**
 * @return {string[]}
 */
AssetDefinition.prototype.getMonikers = function () {
  return this.monikers
}

/**
 * @return {external:coloredcoinjs-lib.ColorSet}
 */
AssetDefinition.prototype.getColorSet = function () {
  return this.colorSet
}

/**
 * @return {string}
 */
AssetDefinition.prototype.getId = function () {
  return this.getColorSet().getColorHash()
}

/**
 * @return {external:coloredcoinjs-lib.ColorDefinition[]}
 */
AssetDefinition.prototype.getColorDefinitions = function () {
  return this.getColorSet().getColorDefinitions()
}

/**
 * @param {string} portion
 * @return {number}
 */
AssetDefinition.prototype.parseValue = function (portion) {
  verify.string(portion)

  var items = portion.split('.')

  var value = parseInt(items[0]) * this.unit

  if (!_.isUndefined(items[1])) {
    var centString = items[1] + Array(this.unit.toString().length).join('0')
    var centValue = parseInt(centString.slice(0, this.unit.toString().length - 1))

    if (!isNaN(centValue)) {
      value = value + (parseFloat(portion) >= 0 ? centValue : -centValue)
    }
  }

  return value
}

/**
 * @param {number} value
 * @return {string}
 */
AssetDefinition.prototype.formatValue = function (value) {
  verify.number(value)

  var coinString = (~~(value / this.unit)).toString()
  if (coinString === '0' && value < 0) {
    coinString = '-' + coinString
  }

  var centString = Math.abs(value % this.unit).toString()
  var centLength = this.unit.toString().length - 1
  while (centString.length < centLength) {
    centString = '0' + centString
  }

  return coinString + '.' + centString
}


module.exports = AssetDefinition
