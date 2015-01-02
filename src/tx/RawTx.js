var _ = require('lodash')
var Q = require('q')

var bitcoin = require('../bitcoin')
var verify = require('../verify')
var cclib = require('../cclib')


/**
 * @class RawTx
 */
function RawTx() {
  this.txb = new bitcoin.TransactionBuilder()
}

/**
 * @param {external:coloredcoinjs-lib.ComposedTx} composedTx
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
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
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
 * @callback RawTx~signCallback
 * @param {?Error} error
 */

/**
 * @param {Wallet} wallet
 * @param {string} seedHex
 * @param {RawTx~signCallback} cb
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
        return wallet.getStateManager().getTx(txId)

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
 * @return {external:coloredcoinjs-lib.bitcoin.Transaction}
 */
RawTx.prototype.toTransaction = function (allowIncomplete) {
  allowIncomplete = _.isUndefined(allowIncomplete) ? false : allowIncomplete
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

/**
 * @callback RawTx~getColorTargetsCallback
 * @param {?Error} error
 * @param {Array.<external:coloredcoinjs-lib.bitcoin.ColorTarget>} colorTargets
 */

/**
 * @param {Wallet} wallet
 * @param {RawTx~getColorTargetsCallback} cb
 */
RawTx.prototype.getColorTargets = function (wallet, cb) {
  verify.Wallet(wallet)
  verify.function(cb)

  var tx = this.toTransaction(true)
  Q.ninvoke(wallet.getStateManager(), 'getTxMainColorValues', tx).then(function (colorValues) {
    return tx.outs.map(function (txOut, outIndex) {
      return new cclib.ColorTarget(txOut.script.toHex(), colorValues[outIndex])
    })

  }).done(
    function (colorTargets) { cb(null, colorTargets) },
    function (error) { cb(error) }
  )
}

/**
 * @callback RawTx~satisfiesTargetsCallback
 * @param {?Error} error
 * @param {boolean} isSatisfied
 */

/**
 * @param {Wallet} wallet
 * @param {Array.<external:coloredcoinjs-lib.ColorTarget>} colorTargets
 * @param {boolean} [allowExtra=false]
 * @param {RawTx~satisfiesTargetsCallback} cb
 */
RawTx.prototype.satisfiesTargets = function (wallet, colorTargets, allowExtra, cb) {
  if (_.isFunction(allowExtra) && _.isUndefined(cb)) {
    cb = allowExtra
    allowExtra = undefined
  }
  allowExtra = _.isUndefined(allowExtra) ? false : allowExtra

  verify.Wallet(wallet)
  verify.array(colorTargets)
  colorTargets.forEach(verify.ColorTarget)
  verify.boolean(allowExtra)
  verify.function(cb)

  Q.ninvoke(this, 'getColorTargets', wallet).then(function (txColorTargets) {
    var lengthSatisfy = (
      (allowExtra && txColorTargets.length >= colorTargets.length) ||
      (!allowExtra && txColorTargets.length === colorTargets.length)
    )
    if (!lengthSatisfy) {
      return false
    }

    function transformFn(ct) {
      return ct.getScript() + ct.getColorDefinition().getDesc() + ct.getValue()
    }

    colorTargets = colorTargets.map(transformFn)
    txColorTargets = txColorTargets.map(transformFn)
    return _.difference(colorTargets, txColorTargets).length === 0

  }).done(
    function (isSatisfied) { cb(null, isSatisfied) },
    function (error) { cb(error) }
  )
}

module.exports = RawTx
