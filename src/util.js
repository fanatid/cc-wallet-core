var _ = require('lodash')

var util = require('./cclib').util


/**
 * @class OrderedMap
 */
function OrderedMap() {
  this._keys = {}
  this._vals = []
}

/**
 * @param {string} key
 * @param {?} val
 */
OrderedMap.prototype.add = function (key, val) {
  if (_.isUndefined(this._keys[key])) {
    this._keys[key] = true
    this._vals.push(val)
  }
}

/**
 * @return {string[]}
 */
OrderedMap.prototype.getKeys = function () { return _.keys(this._keys) }

/**
 * @return {string[]}
 */
OrderedMap.prototype.getVals = function () { return this._vals }


/**
 * @event SyncMixin#syncStart
 */

/**
 * @event SyncMixin#syncStop
 */

/**
 * @mixin SyncMixin
 */
function SyncMixin() {
  var self = this
  var syncCount = 0

  /**
   * @return {boolean}
   */
  self.isSyncing = function () {
    return syncCount > 0
  }

  /**
   */
  self._syncEnter = function () {
    syncCount += 1
    if (syncCount === 1) { self.emit('syncStart') }
  }

  /**
   */
  self._syncExit = function () {
    syncCount -= 1
    if (syncCount === 0) { self.emit('syncStop') }
  }
}


module.exports = _.extend(util, {
  OrderedMap: OrderedMap,
  SyncMixin: SyncMixin
})