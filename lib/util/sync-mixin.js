/**
 * @event SyncMixin#syncStart
 */

/**
 * @event SyncMixin#syncStop
 */

/**
 * @mixin SyncMixin
 * @param {Object} object
 */
function SyncMixin (object) {
  /**
   * @private
   * @return {number}
   */
  object._getSyncCount = function () {
    if (this._syncCount === undefined) {
      this._syncCount = 0
    }

    return this._syncCount
  }

  /**
   * @private
   * @param {number}
   */
  object._setSyncCount = function (value) {
    this._syncCount = value

    if (value === 0) {
      return this.emit('syncStop')
    }

    if (value === 1) {
      return this.emit('syncStart')
    }
  }

  /**
   * @private
   */
  object._syncEnter = function () {
    this._setSyncCount(this._getSyncCount() + 1)
  }

  /**
   * @private
   */
  object._syncExit = function () {
    this._setSyncCount(this._getSyncCount() - 1)
  }

  /**
   * @private
   */
  object._syncExitAll = function () {
    this._setSyncCount(0)
  }

  /**
   * @return {boolean}
   */
  object.isSyncing = function () {
    return this._getSyncCount() > 0
  }
}

module.exports = SyncMixin
