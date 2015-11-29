var _ = require('lodash')
var Q = require('q')
var bitcore = require('bitcore-lib')
var cclib = require('coloredcoinjs-lib')
var script2addresses = require('script2addresses')

/**
 * @class RawTx
 * @param {bitcore.Transaction} [tx]
 */
function RawTx (tx) {
  this.tx = tx
  if (!this.tx) {
    tx = new bitcore.Transaction()
  }
}

/**
 * @param {cclib.tx.Composed} composedTx
 * @return {RawTx}
 */
RawTx.fromComposedTx = function (composedTx) {
  var tx = new bitcore.Transaction()
  composedTx.getInputs().forEach(function (input) {
    tx.from({
      txId: input.txId,
      outputIndex: input.outIndex,
      satoshis: input.value,
      script: input.script
    })
  })
  composedTx.getOutputs().forEach(function (output) {
    tx.addOutput(new bitcore.Transaction.Output({
      script: new bitcore.Script(output.script),
      satoshis: output.value
    }))
  })

  return new RawTx(tx)
}

/**
 * @param {bitcore.Transaction} tx
 * @return {RawTx}
 */
RawTx.fromTransaction = function (tx) {
  return new RawTx(new bitcore.Transaction(tx))
}

/**
 * @param {string} hex
 * @return {RawTx}
 */
RawTx.fromHex = function (hex) {
  return new RawTx(new bitcore.Transaction(hex))
}

/**
 * @param {boolean} [allowIncomplete=fallse]
 * @return {bitcore.Transaction}
 */
RawTx.prototype.toTransaction = function (allowIncomplete) {
  return new bitcore.Transaction(this.tx.toObject())
}

/**
 * @param {boolean} [allowIncomplete=false]
 * @return {string}
 */
RawTx.prototype.toHex = function (allowIncomplete) {
  return this.toString()
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

  var self = this
  var addressManager = wallet.getAddressManager()

  var promises = self.tx.inputs.map(function (input, index) {
    if (input.isFullySigned() ||
        (signingOnly && signingOnly.indexOf(index) === -1)) {
      return
    }

    return Q.fcall(function () {
      if (input.output.script.toHex() !== '') {
        return
      }

      var txId = input.prevTxId.toString('hex')
      return Q.fcall(function () {
        var prevTx = wallet.getStateManager().getTx(txId)
        if (prevTx !== null) {
          return prevTx
        }

        return wallet.getBlockchain().getTx(txId)
          .then(function (txHex) { return bitcore.Transaction(txHex) })
      })
      .then(function (prevTx) {
        input.output.setScript(prevTx.outputs[input.outputIndex].script)
      })
    })
    .then(function () {
      var script = input.output.script
      var network = wallet.getBitcoinNetwork()
      script2addresses(script.toBuffer(), network).addresses.forEach(function (address) {
        var privKey = addressManager.getPrivKeyByAddress(address, seedHex)
        if (privKey !== null) {
          self.tx.sign(privKey)
        }
      })
    })
  })

  Q.all(promises).then(function () { cb(null) }, function (error) { cb(error) })
}

/**
 * @callback RawTx~getColorTargetsCallback
 * @param {?Error} error
 * @param {Array.<cclib.ColorTarget>} colorTargets
 */

/**
 * @param {Wallet} wallet
 * @param {RawTx~getColorTargetsCallback} cb
 */
RawTx.prototype.getColorTargets = function (wallet, cb) {
  var tx = this.toTransaction(true)
  Q.ninvoke(wallet.getStateManager(), 'getTxMainColorValues', tx)
    .then(function (colorValues) {
      return tx.outputs.map(function (output, outputIndex) {
        return new cclib.ColorTarget(output.script.toHex(), colorValues[outputIndex])
      })
    })
    .then(function (colorTargets) { cb(null, colorTargets) },
          function (error) { cb(error) })
}

/**
 * @callback RawTx~satisfiesTargetsCallback
 * @param {?Error} error
 * @param {boolean} isSatisfied
 */

/**
 * @param {Wallet} wallet
 * @param {cclib.ColorTarget[]} colorTargets
 * @param {boolean} [allowExtra=false]
 * @param {RawTx~satisfiesTargetsCallback} cb
 */
RawTx.prototype.satisfiesTargets = function (wallet, colorTargets, allowExtra, cb) {
  if (_.isFunction(allowExtra) && _.isUndefined(cb)) {
    cb = allowExtra
    allowExtra = undefined
  }
  allowExtra = allowExtra === undefined ? false : allowExtra

  var tx = this.toTransaction(true)
  var outScripts = _.invoke(colorTargets, 'getScript')

  var lengthSatisfy = true
  Q.all(tx.outputs.map(function (output, outputIndex) {
    var script = output.script.toHex()
    if (_.contains(outScripts, script)) {
      var coin = {tx: tx, outIndex: outputIndex, value: output.value}
      return Q.ninvoke(wallet.getStateManager(), 'getCoinMainColorValue', coin)
        .then(function (cv) {
          return new cclib.ColorTarget(script, cv)
        })
    } else {
      if (!allowExtra) {
        lengthSatisfy = false
      }

      return null
    }
  }))
  .then(function (txColorTargets) {
    if (!lengthSatisfy) {
      return false
    }

    // remove null color targets (ones we aren't interesting in)
    txColorTargets = _.filter(txColorTargets)

    lengthSatisfy = (
      (allowExtra && txColorTargets.length >= colorTargets.length) ||
      (!allowExtra && txColorTargets.length === colorTargets.length)
    )
    if (!lengthSatisfy) {
      return false
    }

    function transformFn (ct) {
      return ct.getScript() + ct.getColorDefinition().getDesc() + ct.getValue()
    }

    colorTargets = colorTargets.map(transformFn)
    txColorTargets = txColorTargets.map(transformFn)

    return _.difference(colorTargets, txColorTargets).length === 0
  })
  .then(function (isSatisfied) { cb(null, isSatisfied) },
        function (error) { cb(error) })
}

RawTx.prototype.getOutputIndexesForAddress = function (wallet, address) {
  var network = wallet.getBitcoinNetwork()
  var tx = this.toTransaction(true)
  var indices = []
  tx.outputs.forEach(function (output, outputIndex) {
    var addresses = script2addresses(output.script.toBuffer(), network).addresses
    if (addresses.indexOf(address) >= 0) {
      indices.push(outputIndex)
    }
  })
  return indices
}

RawTx.prototype.getOutputAddresses = function (wallet) {
  var network = wallet.getBitcoinNetwork()
  var tx = this.toTransaction(true)
  return _.flatten(tx.outputs.map(function (output) {
    return script2addresses(output.script.toBuffer(), network).addresses
  }))
}

/**
 * @param {Wallet} wallet
 * @param {RawTx~getColorValuesCallback} cb
 */
RawTx.prototype.getSentColorValues = function (wallet, cb) {
  var blockchain = wallet.getBlockchain()
  var getTxFn = blockchain.getTx.bind(blockchain)
  var tx = this.toTransaction(true)
  var network = wallet.getBitcoinNetwork()
  var walletAddresses = wallet.getAllAddresses()
  var wsm = wallet.getStateManager()

  var ftx = new cclib.tx.FilledInputs(tx, getTxFn)
  Q.all(tx.inputs.map(function (input, inputIndex) {
    return ftx.getInputTx(inputIndex)
      .then(function (inputTx) {
        var inputOutput = inputTx.outputs[input.outputIndex]
        var addresses = script2addresses(inputOutput.script.toBuffer(), network).addresses
        if (_.intersection(addresses, walletAddresses).length === 0) {
          return
        }

        var rawCoin = {
          txId: input.prevTxId.toString('hex'),
          outIndex: input.outputIndex,
          value: inputOutput.satoshis
        }
        return Q.ninvoke(wsm, 'getCoinMainColorValue', rawCoin)
      })
  }))
  .then(function (colorValues) { cb(null, _.filter(colorValues)) },
        function (error) { cb(error) })
}

/**
 * @param {Wallet} wallet
 * @param {RawTx~getColorValuesCallback} cb
 */
RawTx.prototype.getReceivedColorValues = function (wallet, cb) {
  var tx = this.toTransaction(true)
  var network = wallet.getBitcoinNetwork()
  var walletAddresses = wallet.getAllAddresses()

  Q.ninvoke(wallet.getStateManager(), 'getTxMainColorValues', tx)
    .then(function (colorValues) {
      return _.chain(tx.outputs)
        .map(function (output, outputIndex) {
          var addresses = script2addresses(output.script.toBuffer(), network).addresses
          if (_.intersection(addresses, walletAddresses).length === 0) {
            return
          }

          return colorValues[outputIndex]
        })
        .filter()
        .value()
    })
    .then(function (colorValues) { cb(null, colorValues) },
          function (error) { cb(error) })
}

function _deltas2map (deltas) {
  var map = {}
  deltas.forEach(function (delta) {
    map[delta.getColorId()] = delta
  })
  return map
}

RawTx.prototype.satisfiesDeltas = function (wallet, deltas, allowExtra, cb) {
  if (_.isFunction(allowExtra) && _.isUndefined(cb)) {
    cb = allowExtra
    allowExtra = undefined
  }
  allowExtra = allowExtra === undefined ? false : allowExtra
  // FIXME add maxfee

  this.getDeltaColorValues(wallet, function (error, txDeltas) {
    if (error) { return cb(error) }
    var deltasMap = _deltas2map(deltas)
    var txDeltasMap = _deltas2map(txDeltas)
    var deltaIds = _.keys(deltasMap)
    var txDeltaIds = _.keys(txDeltasMap)

    // check that all delta colorvalues are in txDeltas
    if (_.intersection(deltaIds, txDeltaIds).length !== deltaIds.length) {
      return cb(new Error('Deltas not satisfied!'))
    }

    // check for extra entries
    if (!allowExtra && (_.difference(deltaIds, txDeltaIds).length !== 0)) {
      return cb(new Error('Deltas not satisfied!'))
    }

    // check values
    deltaIds.forEach(function (colorId) {
      if (error) {
        return
      }

      var value = deltasMap[colorId].getValue()
      var txValue = txDeltasMap[colorId].getValue()
      if (allowExtra && (value > txValue)) {
        error = new Error('Deltas not satisfied!')
      } else if (!allowExtra && (value !== txValue)) {
        error = new Error('Deltas not satisfied!')
      }
    })

    // deltas satisfied
    cb(error)
  })
}

/**
 * @param {Wallet} wallet
 * @param {RawTx~getColorValuesCallback} cb
 */
RawTx.prototype.getDeltaColorValues = function (wallet, cb) {
  var promises = [
    Q.ninvoke(this, 'getSentColorValues', wallet),
    Q.ninvoke(this, 'getReceivedColorValues', wallet)
  ]

  Q.all(promises)
    .spread(function (sentColorValues, receivedColorValues) {
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
    })
    .then(function (colorValues) { cb(null, colorValues) },
          function (error) { cb(error) })
}

/**
 * @callback RawTx~getInputAddressesCallback
 * @param {?Error} error
 * @param {string[]} addresses
 */

/**
 * @param {Wallet} wallet Wallet for blockchain access
 * @param {number[]} [indices] Scan only given indices
 * @param {RawTx~getInputAddressesCallback} cb
 */
RawTx.prototype.getInputAddresses = function (wallet, indices, cb) {
  var tx = this.toTransaction(true)

  if (_.isFunction(indices) && _.isUndefined(cb)) {
    cb = indices
    indices = undefined
  }
  if (_.isUndefined(indices)) {
    indices = _.range(tx.inputs.length)
  }

  var bitcoinNetwork = wallet.getBitcoinNetwork()
  var blockchain = wallet.getBlockchain()
  var getTxFn = blockchain.getTx.bind(blockchain)
  var ftx = new cclib.tx.FilledInputs(tx, getTxFn)
  Q.all(indices.map(function (inputIndex) {
    return ftx.getInputTx(inputIndex)
      .then(function (inputTx) {
        var script = inputTx.outputs[tx.inputs[inputIndex].outputIndex].script
        return script2addresses(script.toBuffer(), bitcoinNetwork).addresses
      })
  }))
  .then(function (inputAddresses) { cb(null, _.flatten(inputAddresses)) },
        function (error) { cb(error) })
}

module.exports = RawTx
