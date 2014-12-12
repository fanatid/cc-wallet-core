var events = require('events')
var inherits = require('util').inherits

var util = require('./util')
var verify = require('./verify')


/**
 * @class WalletStateManager
 * @extends events.EventEmitter
 * @mixes SyncMixin
 * @param {Wallet} wallet
 */
function WalletStateManager(wallet) {
  verify.Wallet(wallet)

  var self = this
  events.EventEmitter.call(self)
  util.SyncMixin.call(self)



}

inherits(WalletStateManager, events.EventEmitter)


module.exports = WalletStateManager
