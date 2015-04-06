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
    return self._wallet.getBlockchain().subscribeAddress(address)
  }

  function subscribeAddressAndSync(address) {
    return subscribeAddress(address).then(sync).catch(function (err) { self.emit('error', err) })
  }

  function subscribeAllAndSync () {
    Q.all( self._wallet.getAllAddresses().map(subscribeAddress) )
      .then(sync).catch(function (err) { self.emit('error', err) })
  }


  self._wallet.once('initialize', function () {
    console.log('WEN.initialize')
    if (self._wallet.getNetwork().isConnected())
      subscribeAllAndSync()
  })

  self._wallet.getNetwork().on('connect', function () {
    console.log('WEN.connect')
    if (self._wallet.isInitialized())
      subscribeAllAndSync()
  })

  self._wallet.getBlockchain().on('touchAddress', function () {
    console.log('WEN.touchAddress')
    if (self._wallet.isInitialized()) { sync() }
  })

  self._wallet.getAddressManager().on('newAddress', function (address) {
    console.log('WEN.newAddress')
    if (self._wallet.isInitialized()) {
      subscribeAddressAndSync(address.getAddress())
    }
  })

  if (self._wallet.getNetwork().isConnected() && self._wallet.isInitialized()) {
    console.log('WEN.saas')
    subscribeAllAndSync()
  }
}


module.exports = WalletEventNotifier
