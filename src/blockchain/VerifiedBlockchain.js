var HeaderStorage = require('./HeaderStorage')

var bitcoin = require('../cclib').bitcoin
var verify = require('../verify')


/**
 * @param {Buffer} rawHeader
 * @return {Buffer}
 */
function headerHash(rawHeader) {
  return bitcoin.crypto.hash256(rawHeader)
}


/**
 * @class VerifiedBlockchain
 * @param {Wallet} wallet
 */
function VerifiedBlockchain(wallet) {
  verify.Wallet(wallet)

  var self = this

  self._wallet = wallet
  self._wallet.getNetwork().on('newHeight', function() {

  })

  self._storage = new HeaderStorage()
  self._currentHeight = self._storage.count() - 1
  self._lastHash = new Buffer(32).fill(0)
  if (self.getCurrentHeight() >= 0)
    self._lastHash = headerHash(self._storage.getHeader(self.getCurrentHeight()))
}

/**
 * @return {number}
 */
VerifiedBlockchain.prototype.getCurrentHeight = function() {
  return this._currentHeight
}


module.exports = VerifiedBlockchain
