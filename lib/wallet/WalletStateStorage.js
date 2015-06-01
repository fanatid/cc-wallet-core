var inherits = require('util').inherits

var _ = require('lodash')

var SyncStorage = require('../SyncStorage')

/**
 * @class WalletStateStorage
 * @extends SyncStorage
 */
function WalletStateStorage () {
  SyncStorage.apply(this, Array.prototype.slice.call(arguments))

  this._stateDBKey = this.globalPrefix + 'stateV3'
  this._state = this.store.get(this._stateDBKey) || null

  this._saveTimeout = null
}

inherits(WalletStateStorage, SyncStorage)

/**
 * @return {?string} state
 */
WalletStateStorage.prototype.getState = function () {
  return this._state
}

/**
 * @param {string} state
 * @param {Object} [opts]
 * @param {boolean} [opts.saveNow=false]
 */
WalletStateStorage.prototype.saveState = function (state, opts) {
  opts = _.extend({saveNow: false}, opts)

  var self = this
  self._state = state

  if (self._saveTimeout !== null) {
    clearTimeout(self._saveTimeout)
    self._saveTimeout = null
  }

  if (opts.saveNow) {
    return self.store.set(self._stateDBKey, self._state)
  }

  self._saveTimeout = setTimeout(function () {
    self.store.set(self._stateDBKey, self._state)
    self._saveTimeout = null

  }, 5000)
}

/**
 * Remove state from store immediately
 */
WalletStateStorage.prototype.removeState = function () {
  this._state = null

  if (this._saveTimeout !== null) {
    clearTimeout(this._saveTimeout)
    this._saveTimeout = null
  }

  this.store.remove(this._stateDBKey)
}

module.exports = WalletStateStorage
