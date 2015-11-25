var TxManager = require('../tx').TxManager
var CoinManager = require('../coin').CoinManager
var HistoryManager = require('../history').HistoryManager
var TxStateSet = require('blockchainjs').TxStateSet

/**
 * @class WalletState
 * @param {Wallet} wallet
 * @param {WalletStateStorage} stateStorage
 */
function WalletState (wallet, stateStorage) {
  this._storage = stateStorage

  this._state = this._storage.getState()
  if (this._state === null) {
    this._state = JSON.stringify({
      TxManager: {},
      CoinManager: {},
      HistoryManager: {},
      TxStateSet: null
    })
  }
  this._state = JSON.parse(this._state)

  this._txManager = new TxManager(wallet, this, this._state.TxManager)
  this._coinManager = new CoinManager(wallet, this, this._state.CoinManager)
  this._historyManager = new HistoryManager(wallet, this, this._state.HistoryManager)
  try {
    this._txStateSet = new TxStateSet(this._state.TxStateSet)
  } catch (err) {
    console.log('Unable to re-create TxStateSet, reset', err)
    this._state.TxStateSet = null
    this._txStateSet = new TxStateSet(this._state.TxStateSet)
  }
}

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
 * @return {blockchainjs.TxStateSet}
 */
WalletState.prototype.getTxStateSet = function () { return this._txStateSet }

/**
 * @param {blockchainjs.TxStateSet} tSS
 */
WalletState.prototype.setTxStateSet = function (tSS) {
  this._txStateSet = tSS
  this._state.TxStateSet = tSS.getState()
}

/**
 * @param {Object} [opts]
 * @param {boolean} [opts.saveNow=false]
 */
WalletState.prototype.save = function (opts) {
  this._storage.saveState(JSON.stringify(this._state), opts)
}

/**
 */
WalletState.prototype.clear = function () {
  this._storage.removeState()
}

module.exports = WalletState
