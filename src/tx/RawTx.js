var _ = require('lodash')
var Q = require('q')

var bitcoin = require('../bitcoin')
var verify = require('../verify')
var cclib = require('../cclib')


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

      // mostly for multisig
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
      var scripts = self.txb.prevOutScripts[index]
      var network = wallet.getBitcoinNetwork()
      var addresses = bitcoin.util.getAddressesFromScript(scripts, network)
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

/**
 * @callback {RawTx~getColorValuesCallback}
 * @param {?Error} error
 * @param {Array.<external:coloredcoinjs-lib.ColorValue>} values
 */

/**
 * @param {Wallet} wallet
 * @param {RawTx~getColorValuesCallback} cb
 */
RawTx.prototype.getSentColorValues = function (wallet, cb) {
  verify.Wallet(wallet)
  verify.function(cb)

  var getTxFn = wallet.getBlockchain().getTxFn()
  var tx = this.toTransaction(true)
  var network = wallet.getBitcoinNetwork()
  var walletAddresses = wallet.getAllAddresses()
  var wsm = wallet.getStateManager()

  Q.ninvoke(tx, 'ensureInputValues', getTxFn).then(function (tx) {
    var promises = _.chain(tx.ins)
      .map(function (input) {
        var script = input.prevTx.outs[input.index].script
        var addresses = bitcoin.util.getAddressesFromScript(script, network)
        if (_.intersection(addresses, walletAddresses).length === 0) {
          return
        }

        var rawCoin = {
          txId: input.prevTx.getId(),
          outIndex: input.index,
          value: input.prevTx.outs[input.index].value
        }
        return Q.ninvoke(wsm, 'getCoinMainColorValue', rawCoin)
      })
      .flatten()
      .filter()
      .value()

    return Q.all(promises)

  }).done(
    function (colorValues) { cb(null, colorValues) },
    function (error) { cb(error) }
  )
}

/**
 * @param {Wallet} wallet
 * @param {RawTx~getColorValuesCallback} cb
 */
RawTx.prototype.getReceivedColorValues = function (wallet, cb) {
  verify.Wallet(wallet)
  verify.function(cb)

  var tx = this.toTransaction(true)
  var network = wallet.getBitcoinNetwork()
  var walletAddresses = wallet.getAllAddresses()

  Q.ninvoke(wallet.getStateManager(), 'getTxMainColorValues', tx).then(function (colorValues) {
    return _.chain(tx.outs)
      .map(function (txOut, outIndex) {
        var addresses = bitcoin.util.getAddressesFromScript(txOut.script, network)
        if (_.intersection(addresses, walletAddresses).length === 0) {
          return
        }

        return colorValues[outIndex]
      })
      .filter()
      .value()

  }).done(
    function (colorValues) { cb(null, colorValues) },
    function (error) { cb(error) }
  )
}

/**
 * @param {Wallet} wallet
 * @param {RawTx~getColorValuesCallback} cb
 */
RawTx.prototype.getDeltaColorValues = function (wallet, cb) {
  verify.Wallet(wallet)
  verify.function(cb)

  var promises = [
    Q.ninvoke(this, 'getSentColorValues', wallet),
    Q.ninvoke(this, 'getReceivedColorValues', wallet)
  ]

  Q.all(promises).spread(function (sentColorValues, receivedColorValues) {
    return _.chain(sentColorValues)
      .invoke('neg')
      .concat(receivedColorValues)
      .groupBy(function (colorValue) {
        return colorValue.getColorId()
      })
      .map(function (colorValues) {
        return cclib.ColorValue.sum(colorValues)
      })
      .value()

  }).done(
    function (colorValues) { cb(null, colorValues) },
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
