var inherits = require('util').inherits

var _ = require('lodash')

var TxManager = require('../tx').TxManager
var CoinManager = require('../coin').CoinManager
var HistoryManager = require('../history').HistoryManager
var SyncStorage = require('../SyncStorage')
var verify = require('../verify')


/**
 * @class WalletState
 * @extends SyncStorage
 */
function WalletState(wallet) {
  verify.Wallet(wallet)

  SyncStorage.apply(this, Array.prototype.slice.call(arguments))

  this._stateDBKey = this.globalPrefix + 'stateV2'
  this._state = _.defaults(this.store.get(this._stateDBKey) || {}, {
    TxManager: {},
    CoinManager: {},
    HistoryManager: {}
  })

  this._txManager = new TxManager(wallet, this, this._state.TxManager)
  this._coinManager = new CoinManager(wallet, this, this._state.CoinManager)
  this._historyManager = new HistoryManager(wallet, this, this._state.HistoryManager)
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
}


module.exports = WalletState
