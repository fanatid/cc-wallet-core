var _ = require('lodash')
var Q = require('q')

var bitcoin = require('../bitcoin')
var verify = require('../verify')


/**
 * @class RawTx
 */
function RawTx() {
  this.txb = new bitcoin.TransactionBuilder()
}

/**
 * @param {ComposedTx} composedTx
 * @return {RawTx}
 */
RawTx.fromComposedTx = function (composedTx) {
  verify.ComposedTx(composedTx)

  var rawTx = new RawTx()

  composedTx.getTxIns().forEach(function (txIn) {
    rawTx.txb.addInput(txIn.txId, txIn.outIndex, txIn.sequence)
  })

  composedTx.getTxOuts().forEach(function (txOut) {
    rawTx.txb.addOutput(bitcoin.Script.fromHex(txOut.script), txOut.value)
  })

  return rawTx
}

/**
 * @param {bitcoinjs-lib.Transaction} tx
 * @return {RawTx}
 */
RawTx.fromTransaction = function (tx) {
  verify.Transaction(tx)

  var rawTx = new RawTx()
  rawTx.txb = bitcoin.TransactionBuilder.fromTransaction(tx)

  return rawTx
}

/**
 * @param {string} hex
 * @return {RawTx}
 */
RawTx.fromHex = function (hex) {
  verify.hexString(hex)

  var tx = bitcoin.Transaction.fromHex(hex)
  return RawTx.fromTransaction(tx)
}

/**
 * @callback RawTx~sign
 * @param {?Error} error
 */

/**
 * @param {Wallet} opts.wallet
 * @param {string} opts.seedHex
 */
RawTx.prototype.sign = function (wallet, seedHex, cb) {
  verify.Wallet(wallet)
  verify.hexString(seedHex)
  verify.function(cb)

  var self = this
  var addressManager = wallet.getAddressManager()

  var promises = self.txb.tx.ins.map(function (input, index) {
    return Q.fcall(function () {
      if (!_.isUndefined(self.txb.prevOutScripts[index])) {
        return
      }

      var txId = Array.prototype.reverse.call(new Buffer(input.hash)).toString('hex')

      return Q.fcall(function () {
        return wallet.getTxDb().getTx(txId)

      }).then(function (tx) {
        return tx !== null ? tx : Q.ninvoke(wallet.getBlockchain(), 'getTx', txId)

      }).then(function (tx) {
        self.txb.prevOutScripts[index] = tx.outs[input.index].script
        self.txb.prevOutTypes[index] = bitcoin.scripts.classifyOutput(self.txb.prevOutScripts[index])

      })

    }).then(function () {
      var addresses = bitcoin.getAddressesFromOutputScript(self.txb.prevOutScripts[index], wallet.getBitcoinNetwork())
      addresses.forEach(function (address) {
        var privKey = addressManager.getPrivKeyByAddress(address, seedHex)
        if (privKey !== null) {
          self.txb.sign(index, privKey)
        }
      })

    })
  })

  Q.all(promises).done(function () { cb(null) }, function (error) { cb(error) })
}

/**
 * @param {boolean} [allowIncomplete=fallse]
 * @return {bitcoinjs-lib.Transaction}
 */
RawTx.prototype.toTransaction = function (allowIncomplete) {
  allowIncomplete = allowIncomplete || false
  verify.boolean(allowIncomplete)

  if (allowIncomplete) {
    return this.txb.buildIncomplete()
  }

  return this.txb.build()
}

/**
 * @param {boolean} [allowIncomplete=false]
 * @return {string}
 */
RawTx.prototype.toHex = function (allowIncomplete) {
  return this.toTransaction(allowIncomplete).toHex()
}


module.exports = RawTx
