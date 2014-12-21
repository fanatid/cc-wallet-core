var inherits = require('util').inherits

var _ = require('lodash')

var TxManager = require('../tx/TxManager')
var CoinManager = require('../coin/CoinManager')
var HistoryManager = require('../history/HistoryManager')
var SyncStorage = require('../SyncStorage')
var verify = require('../verify')


/**
 * @class WalletState
 * @extends SyncStorage
 */
function WalletState(wallet) {
  verify.Wallet(wallet)

  SyncStorage.apply(this, Array.prototype.slice.call(arguments))

  this._stateDBKey = this.globalPrefix + 'state'

  this._state = this.store.get(this._stateDBKey) || {}
  this._state = _.defaults(this._state, {'tx': {}, 'coin': {}, 'history': []})

  if (_.isUndefined(this.store.get(this._stateDBKey + '_version'))) {
    this.store.set(this._stateDBKey + '_version', 1)
  }

  this._txManager = new TxManager(wallet, this._state.tx)
  this._coinManager = new CoinManager(wallet, this._txManager, this._state.coin)
  this._historyManager = new HistoryManager(wallet, this._txManager, this._coinManager, this._state.history)
}

inherits(WalletState, SyncStorage)

/**
 * @return {TxManager}
 */
WalletState.prototype.getTxManager = function () { return this._txManager }

/**
 * @return {CoinManager}
 */
WalletState.prototype.getCoinManager = function () { return this._coinManager }

/**
 * @return {HistoryManager}
 */
WalletState.prototype.getHistoryManager = function () { return this._historyManager }

/**
 */
WalletState.prototype.save = function () {
  this.store.set(this._stateDBKey, this._state)
}

/**
 */
WalletState.prototype.clear = function () {
  this.store.remove(this._stateDBKey)
  this.store.remove(this._stateDBKey + '_version')
}


module.exports = WalletState
