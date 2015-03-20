var events = require('events')
var inherits = require('util').inherits

var util = require('../util')


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
  this._addEventListeners()
}

inherits(WalletEventNotifier, events.EventEmitter)

/**
 */
WalletEventNotifier.prototype._addEventListeners = function () {
  var self = this

  function sync() {
    var addresses = self._wallet.getAllAddresses()
    self._wallet.getStateManager().sync(addresses)
  }

  /**
   * @param {string} address
   */
  function subscribeAddress(address) {
    self._wallet.getBlockchain().subscribeAddress(address)
      .then(function () { sync() },
            function (err) { self.emit('error', err) })
  }

  self._wallet.once('initialize', function () {
    if (self._wallet.getNetwork().isConnected()) {
      self._wallet.getAllAddresses().forEach(subscribeAddress.bind(self))
    }
  })

  self._wallet.getNetwork().on('connect', function () {
    if (self._wallet.isInitialized()) {
      self._wallet.getAllAddresses().forEach(subscribeAddress.bind(self))
    }
  })

  self._wallet.getBlockchain().on('touchAddress', function () {
    if (self._wallet.isInitialized()) { sync() }
  })

  self._wallet.getAddressManager().on('newAddress', function (address) {
    if (self._wallet.isInitialized()) {
      self._subscribeAddress(address.getAddress())
    }
  })

  if (self._wallet.getNetwork().isConnected() && self._wallet.isInitialized()) {
    self._wallet.getAllAddresses().forEach(subscribeAddress.bind(self))
  }
}


module.exports = WalletEventNotifier
