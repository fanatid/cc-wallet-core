var util = require('./cclib').util


/**
 * @mixin SyncMixin
 */
util.SyncMixin = function () {
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


module.exports = util
