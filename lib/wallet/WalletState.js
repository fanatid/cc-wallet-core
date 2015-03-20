var blockchainjs = require('blockchainjs')

var TxManager = require('../tx').TxManager
var CoinManager = require('../coin').CoinManager
var HistoryManager = require('../history').HistoryManager
var verify = require('../verify')


/**
 * @class WalletState
 * @param {Wallet} wallet
 * @param {WalletStateStorage} stateStorage
 */
function WalletState(wallet, stateStorage) {
  verify.Wallet(wallet)
  verify.WalletStateStorage(stateStorage)

  this._storage = stateStorage

  this._state = this._storage.getState()
  if (this._state === null) {
    this._state = JSON.stringify({
      TxStateSet: {},
      TxManager: {},
      CoinManager: {},
      HistoryManager: {}
    })
  }
  this._state = JSON.parse(this._state)

  this._txStateSet = new blockchainjs.TxStateSet(this._state.TxStateSet)
  this._txManager = new TxManager(wallet, this, this._state.TxManager)
  this._coinManager = new CoinManager(wallet, this, this._state.CoinManager)
  this._historyManager = new HistoryManager(wallet, this, this._state.HistoryManager)
}

/**
 * @return {blockchainjs.TxStateSet}
 */
WalletState.prototype.getTxStateSet = function () { return this._txStateSet }

/**
 * @param {blockchainjs.TxStateSet} txss
 */
WalletState.prototype.getTxStateSet = function (txss) {
  this._txStateSet = txss
  this._state.TxStateSet = this._txStateSet.getState()
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
