var _ = require('lodash')
var Q = require('q')

var bitcoin = require('../bitcoin')
var verify = require('../verify')
var cclib = require('../cclib')
var Coin = require('../coin').Coin


/**
 * @class RawTx
 * @param {external:coloredcoin-jslib.bitcoin.TransactionBuilder} [txb]
 */
function RawTx(txb) {
  if (_.isUndefined(txb)) {
    txb = new bitcoin.TransactionBuilder()
  }

  verify.TransactionBuilder(txb)

  this.txb = txb
}

/**
 * @param {external:coloredcoinjs-lib.ComposedTx} composedTx
 * @return {RawTx}
 */
RawTx.fromComposedTx = function (composedTx) {
  verify.ComposedTx(composedTx)

  var txb = new bitcoin.TransactionBuilder()
  composedTx.getTxIns().forEach(function (txIn) {
    txb.addInput(txIn.txId, txIn.outIndex, txIn.sequence)
  })
  composedTx.getTxOuts().forEach(function (txOut) {
    txb.addOutput(bitcoin.Script.fromHex(txOut.script), txOut.value)
  })

  return new RawTx(txb)
}

/**
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 * @return {RawTx}
 */
RawTx.fromTransaction = function (tx) {
  verify.Transaction(tx)

  var txb = bitcoin.TransactionBuilder.fromTransaction(tx)
  return new RawTx(txb)
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
 * @param {number[]} signingOnly
 * @param {RawTx~signCallback} cb
 */
RawTx.prototype.sign = function (wallet, seedHex, signingOnly, cb) {
  if (_.isFunction(signingOnly) && _.isUndefined(cb)) {
    cb = signingOnly
    signingOnly = undefined
  }

  verify.Wallet(wallet)
  verify.hexString(seedHex)
  verify.function(cb)

  var self = this
  var addressManager = wallet.getAddressManager()

  var promises = self.txb.tx.ins.map(function (input, index) {
    if (!_.isUndefined(signingOnly) && signingOnly.indexOf(index) === -1) {
      return
    }

    return Q.fcall(function () {
      if (!_.isUndefined(self.txb.prevOutScripts[index])) {
        return
      }

      var txId = bitcoin.util.hashEncode(input.hash)
      return Q.fcall(function () {
        return wallet.getStateManager().getTx(txId)

      }).then(function (tx) {
        return tx !== null ? tx : Q.ninvoke(wallet.getBlockchain(), 'getTx', txId)

      }).then(function (tx) {
        self.txb.prevOutScripts[index] = tx.outs[input.index].script
        self.txb.prevOutTypes[index] = bitcoin.scripts.classifyOutput(self.txb.prevOutScripts[index])

      })

    }).then(function () {
      var addresses = bitcoin.util.getAddressesFromScript(self.txb.prevOutScripts[index], wallet.getBitcoinNetwork())
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
  Q.ninvoke(wallet.getStateManager(), 'getTxMainColorValues', tx)
  .then(function (colorValues) {
    return tx.outs.map(function (txOut, outIndex) {
      return new cclib.ColorTarget(txOut.script.toHex(), colorValues[outIndex])
    })

  }).done(
    function (colorTargets) { cb(null, colorTargets) },
    function (error) { cb(error) }
  )
}

function _isWalletAddress(wallet, seedHex, script){ // TODO move to wallet
  verify.Wallet(wallet)
  verify.hexString(seedHex)

  var walletControlled = false
  var network = wallet.getBitcoinNetwork()
  var addressManager = wallet.getAddressManager()
  var addresses = cclib.bitcoin.getAddressesFromOutputScript(script, network)
  addresses.forEach(function (address) {
    if (addressManager.getPrivKeyByAddress(address, seedHex) !== null) {
      walletControlled = true
    }
  })
  return walletControlled
}

RawTx.prototype.getSentColorValues = function (wallet, seedHex, cb) {
  verify.Wallet(wallet)
  verify.function(cb)
  var getTxFn = wallet.getBlockchain().getTxFn()
  var tx = this.txb.buildIncomplete()
  Q.ninvoke(tx, 'ensureInputValues', getTxFn).then(function (tx) {

    return Q.all(
      _.chain(tx.ins)

      .filter(function(input){
        var script = input.prevTx.outs[input.index].script
        return _isWalletAddress(wallet, seedHex, script)
      })

      .map(function(input){
        var script = input.prevTx.outs[input.index].script
        var network = wallet.getBitcoinNetwork()
        var addresses = bitcoin.getAddressesFromOutputScript(script, network)
        return addresses.map(function(address){
          var walletState = wallet.getStateManager().getCurrentState()
          var coin = new Coin(walletState.getCoinManager(), {
            txId: input.prevTx.getId(),
            outIndex: input.index,
            value: input.prevTx.outs[input.index].value,
            script: input.prevTx.outs[input.index].script.toHex(),
            address: address
          })
          return Q.ninvoke(coin, 'getMainColorValue')
        })
      })

      .flatten()
      .value()
    )

  }).done(
    function (colorValues) { cb(null, colorValues) },
    function (error) { cb(error) }
  )
}

RawTx.prototype.getReceivedColorValues = function (wallet, seedHex, cb) {
  verify.Wallet(wallet)
  verify.hexString(seedHex)
  verify.function(cb)

  var tx = this.toTransaction(true)
  Q.ninvoke(wallet.getStateManager(), 'getTxMainColorValues', tx)
  .then(function (colorValues) {

    var received = []
    tx.outs.forEach(function (txOut, outIndex) {
      var colorValue = colorValues[outIndex]
      if(_isWalletAddress(wallet, seedHex, txOut.script)){
        received.push(colorValue)
      }
    })
    return received 

  }).done(
    function (colorValues) { cb(null, colorValues) },
    function (error) { cb(error) }
  )

}

RawTx.prototype.getDeltaColorValues = function (wallet, seedHex, cb) {

  verify.Wallet(wallet)
  verify.hexString(seedHex)
  verify.function(cb)

  Q.all([
    Q.ninvoke(this, 'getSentColorValues', wallet, seedHex)
    .then(function (colorValues) {
      return colorValues.map(function(colorValue){
        return colorValue.neg()
      })
    }),
    Q.ninvoke(this, 'getReceivedColorValues', wallet, seedHex)
  ])
  .then(function(colorValues){
    return _.chain(colorValues).flatten().value()
  })
  .then(function(colorValues){
    var deltas = {}
    colorValues.forEach(function(colorValue){
      var delta = deltas[colorValue.getColorDefinition()]
      if (delta){
        deltas[colorValue.getColorDefinition()] = delta.plus(colorValue)
      } else {
        deltas[colorValue.getColorDefinition()] = colorValue
      }
    })
    return Object.keys(deltas).map(function (colorDefinition){
      return deltas[colorDefinition]
    })
  })
  .done(
    function (colorValues) { cb(null, colorValues) },
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

/**
 * @callback RawTx~getInputAddressesCallback
 * @param {?Error} error
 * @param {string[]} addresses
 */

/**
 * @param {Wallet} wallet Wallet for blockchain access
 * @param {number[]} [indexes] Scan only given indexes
 * @param {RawTx~getInputAddressesCallback} cb
 */
RawTx.prototype.getInputAddresses = function (wallet, indexes, cb) {
  if (_.isFunction(indexes) && _.isUndefined(cb)) {
    cb = indexes
    indexes = undefined
  }
  if (_.isUndefined(indexes)) {
    indexes = _.range(this.txb.ins.length)
  }

  verify.Wallet(wallet)
  verify.array(indexes)
  indexes.forEach(verify.number)
  verify.function(cb)

  var tx = this.txb.buildIncomplete()
  var getTxFn = wallet.getBlockchain().getTxFn()
  Q.ninvoke(tx, 'ensureInputValues', getTxFn).then(function (tx) {
    var bitcoinNetwork = wallet.getBitcoinNetwork()
    return _.chain(tx.ins)
      .filter(function () { return indexes.indexOf(arguments[2]) !== -1 })
      .map(function (input) {
        var script = input.prevTx.outs[input.index].script
        return bitcoin.util.getAddressesFromScript(script, bitcoinNetwork)
      })
      .flatten()
      .value()

  }).done(
    function (addresses) { cb(null, addresses) },
    function (error) { cb(error) }
  )
}


module.exports = RawTx
