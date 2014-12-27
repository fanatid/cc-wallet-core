var _ = require('lodash')
var Q = require('q')

var bitcoin = require('../bitcoin')
var verify = require('../verify')
var cclib = require('../cclib')
var Coin = require('../coin').Coin


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


RawTx.prototype.getColorTargets = function(wallet, cb){
  verify.function(cb)
  var self = this
  var network = wallet.getBitcoinNetwork()
  var coinManager = wallet.getStateManager().getCurrentState().getCoinManager()
  var tx = self.toTransaction()
  Q.fcall(function () {
    var promises = tx.outs.map(function (output, index) {
      var script = output.script
      var address = bitcoin.getAddressesFromOutputScript(script, network)[0]
      var coin = new Coin(coinManager, {
        txId: tx.getId(),
        outIndex: index,
        value: output.value,
        script: script.toHex(),
        address: address
      })
      return Q.ninvoke(coin, 'getMainColorValue').then(function (colorValue) {
        return new cclib.ColorTarget(output.script.toHex(), colorValue)
      })
    })
    return Q.all(promises).then(function (result) { return _.filter(result) })
  }).done(
    function (cts) { cb(null, cts) }, 
    function (error) { cb(error) }
  )
}

/**
 * @param {Wallet} wallet
 * @param {[external:coloredcoinjs-lib.ColorTarget]} colorTargets
 * @param {boolean} [allowExtra=false]
 */
RawTx.prototype.satisfiesTargets = function(wallet, colorTargets, allowExtra, cb){
  allowExtra = allowExtra || false
  verify.boolean(allowExtra)
  verify.function(cb)

  this.getColorTargets(wallet, function(error, txColorTargets) {
    if(!allowExtra && colorTargets.length != txColorTargets.length){
      cb(null, false)
    } else {
      var unsatisfiedTargets = _.clone(colorTargets)
      var equivalentColorTargets = function(a, b){
        return (
            a.getValue() == b.getValue() && a.getScript() == b.getScript() &&
            a.getColorDefinition().getDesc() == b.getColorDefinition().getDesc()
        )
      }
      colorTargets.forEach(function (colorTarget) {
        txColorTargets.forEach(function (txColorTarget) {
          if (equivalentColorTargets(colorTarget, txColorTarget)){
            _.pull(unsatisfiedTargets, colorTarget)
          }
        })
      })
      cb(null, unsatisfiedTargets.length == 0)
    }
  })
}

module.exports = RawTx
