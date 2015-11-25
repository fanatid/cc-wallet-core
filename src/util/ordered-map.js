/**
 * @class OrderedMap
 */
function OrderedMap () {
  this._keys = []
  this._values = {}
}

/**
 * @param {string} key
 * @param {*} value
 */
OrderedMap.prototype.add = function (key, value) {
  if (this._values[key] !== undefined) {
    return
  }

  this._keys.push(key)
  this._values[key] = value
}

/**
 * @return {Array.<*>}
 */
OrderedMap.prototype.getValues = function () {
  var self = this
  return self._keys.map(function (key) {
    return self._values[key]
  })
}

module.exports = OrderedMap
