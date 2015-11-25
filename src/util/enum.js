var _ = require('lodash')

/**
 * @param {Object} enumObj
 * @param {Object} obj
 * @return {Object}
 */
module.exports.update = function (enumObj, obj) {
  var props = _.chain(obj)
    .map(function (value, name) {
      if (_.isObject(value)) {
        Object.freeze(value)
      }

      var methodName = 'is' + name[0].toUpperCase() + name.slice(1)
      var method = function (thing) {
        if (_.isArray(value)) {
          return value.indexOf(thing) !== -1
        }

        return thing === value
      }

      return [
        [name, {
          configurable: false,
          enumerable: true,
          writable: false,
          value: value
        }],
        [methodName, {
          configurable: false,
          enumerable: true,
          writable: false,
          value: method
        }]
      ]
    })
    .flatten()
    .zipObject()
    .value()

  return Object.defineProperties(enumObj, props)
}

/**
 * @param {Object} obj
 * @return {Object}
 */
module.exports.create = function (obj) {
  return module.exports.update({}, obj)
}
