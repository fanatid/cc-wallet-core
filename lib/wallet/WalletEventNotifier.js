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
  this._syncEnabled = false

  this._addEventListeners()
}

inherits(WalletEventNotifier, events.EventEmitter)

WalletEventNotifier.prototype._notifyNeedsSync = function () {
  var self = this

  function scheduleSync() {
    if (self._canSync()) {
      self._syncEnter()
      self._scheduleSync(this._syncRetryTimeoutIncrement)
    }
  }

  if (self._wallet.getBlockchain().isSyncing()) {
    self._syncEnter()
    self._wallet.getBlockchain().once('syncStop', function () { 
      scheduleSync()
      self._syncExit()
    })
  } else {
    scheduleSync()
  }
}

WalletEventNotifier.prototype._canSync = function () {
  return this._syncEnabled && this._wallet.isInitialized()
}

WalletEventNotifier.prototype.connect = function () {
  if (!this._syncEnabled) {
    this._syncEnabled = true
    if (this._canSync()) this._notifyNeedsSync()
  }
}

WalletEventNotifier.prototype.disconnect = function () {
  this._syncEnabled = false
  this._cancelPendingSync()
}

WalletEventNotifier.prototype._syncWSM = function (interval) {
  var self = this
  var addresses = self._wallet.getAllAddresses()
  self._wallet.getStateManager().sync(addresses)
  .done(
    function () { self._syncExit()  },
    function (err) {
      if (!self._pendingSync && self._connected) {
        self._scheduleSync(interval + self._syncRetryTimeoutIncrement)
      } else {
        self._syncExit()        
      }
      self.emit('error', err)
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

WalletEventNotifier.prototype._addEventListeners = function () {
  var self = this
  var notifyNeedsSync = this._notifyNeedsSync.bind(this)

  function subscribeAddress(address) {
    if (self._wallet.getConnector().isConnected()) {
      return self._wallet.getBlockchain().subscribeAddress(address)
    } else {
      return Q.resolve()
    }      
  }

  function subscribeAddressAndSync(address) {
    if (!self._canSync()) return;
    subscribeAddress(address).finally(notifyNeedsSync)
    .catch(function (err) { 
      self._connected = false
      self.emit('error', err) 
    })
  }

  function subscribeAllAndSync () {
    if (!self._canSync()) return;
    Q.all( self._wallet.getAllAddresses().map(subscribeAddress) )
    .finally(notifyNeedsSync)
    .catch(function (err) {
      self._connected = false
      self.emit('error', err) 
    })
  }

  self._wallet.once('initialize', function () {subscribeAllAndSync() })
  self._wallet.getConnector().on('disconnect', function () { self._connected = false  })
  self._wallet.getConnector().on('connect', function () {
    self._connected = true
    subscribeAllAndSync()
  })

  self._wallet.getBlockchain().on('touchAddress', function () { notifyNeedsSync() })
  self._wallet.getAddressManager().on('newAddress', function (address) {
    subscribeAddressAndSync(address.getAddress())
  })

  setTimeout(function () {
    if (!self._connected && self._canSync()) notifyNeedsSync();               
  }, 5000)

  subscribeAllAndSync()
}

module.exports = WalletEventNotifier
