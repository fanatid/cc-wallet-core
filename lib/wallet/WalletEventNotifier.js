var events = require('events')
var inherits = require('util').inherits

var util = require('../util')

var Q = require('q')


/**
 * @event WalletEventNotifier#error
 * @param {Error} error
 */

/**
 * @class WalletEventNotifier
 * @extends EventEmitter
 * @param {Wallet} wallet
 */
function WalletEventNotifier(wallet) {
  events.EventEmitter.call(this)
  util.SyncMixin.call(this)

  this._wallet = wallet
  this._syncRetryTimeoutIncrement = 100
  this._pendingSync = null
  this._connected = false

  this._addEventListeners()
}

inherits(WalletEventNotifier, events.EventEmitter)

WalletEventNotifier.prototype._notifyNeedsSync = function () {
  this._syncEnter()
  this._scheduleSync(this._syncRetryTimeoutIncrement)
}

WalletEventNotifier.prototype.disconnect = function () {
  this._connected = false
  this._cancelPendingSync()
}

WalletEventNotifier.prototype._syncWSM = function (interval) {
  var self = this
  var addresses = self._wallet.getAllAddresses()
  self._wallet.getStateManager().sync(addresses)
  .done(
    function () { self._syncExit()  },
    function (err) {
      self.emit('error', err)
      if (!self._pendingSync && self._connected) {
        self._scheduleSync(interval + self._syncRetryTimeoutIncrement)
      }
    }
  )
}

WalletEventNotifier.prototype._cancelPendingSync = function () {
  if (this._pendingSync) {
    var timeout = this._pendingSync.timeout
    this._pendingSync.canceled = true
    this._pendingSync = null
    clearTimeout(timeout)
    this._syncExit()
  }
}

WalletEventNotifier.prototype._scheduleSync = function (interval) {
  var self = this
  this._cancelPendingSync()
  var pendingSync = { canceled: false }
  this._pendingSync = pendingSync
  pendingSync.timeout = setTimeout(function () {
    if (pendingSync.canceled) {
      return
    }

    if (self._pendingSync === pendingSync) {
      self._pendingSync = null
    }

    self._syncWSM(interval)
  }, interval)
}

/**
 */
WalletEventNotifier.prototype._addEventListeners = function () {
  var self = this

  // sync once blockchain is synced
  var notifyNeedsSync = function () { 
    if (self._wallet.getBlockchain().isSyncing()) {
      self._syncEnter()
      self._wallet.getBlockchain().once('syncStop', function () { 
        if (self._connected) self._notifyNeedsSync() 
        self._syncExit()
      })
    } else {
      self._notifyNeedsSync()
    } 
  }

  /**
   * @param {string} address
   */
  function subscribeAddress(address) {
    return self._wallet.getBlockchain().subscribeAddress(address)
  }

  function subscribeAddressAndSync(address) {
    return subscribeAddress(address).then(notifyNeedsSync)
      .catch(function (err) { self.emit('error', err) })
  }

  function subscribeAllAndSync () {
    Q.all( self._wallet.getAllAddresses().map(subscribeAddress) )
      .then(notifyNeedsSync)
      .catch(function (err) { self.emit('error', err) })
  }

  self._wallet.once('initialize', function () {
    if (self._wallet.getConnector().isConnected()) {
      subscribeAllAndSync()
    }
  })

  self._wallet.getConnector().on('disconnect', function () { self.disconnect()  })

  self._wallet.getConnector().on('connect', function () {
    self._connected = true
    if (self._wallet.isInitialized()) {
      subscribeAllAndSync()
    }
  })

  self._wallet.getBlockchain().on('touchAddress', function () {
    if (self._wallet.getConnector().isConnected() && self._wallet.isInitialized()) { notifyNeedsSync() }
  })

  self._wallet.getAddressManager().on('newAddress', function (address) {
    if (self._wallet.getConnector().isConnected() && self._wallet.isInitialized()) {
      subscribeAddressAndSync(address.getAddress())
    }
  })

  if (self._wallet.getConnector().isConnected() && self._wallet.isInitialized()) {
    subscribeAllAndSync()
  }
}


module.exports = WalletEventNotifier
