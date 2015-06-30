'use strict'

var _ = require('lodash')
var bitcore = require('bitcore')
var cclib = require('coloredcoinjs-lib')

var bitcoinUtil = require('../util/bitcoin')

/**
 * @class RawTx
 * @param {Wallet} wallet
 * @param {bitcore.Transaction} [tx]
 */
function RawTx (wallet, tx) {
  this._wallet = wallet
  this._tx = bitcore.Transaction(tx)
}

/**
 * @param {Wallet} wallet
 * @param {bitcore.Transaction} tx
 * @return {RawTx}
 */
RawTx.fromTx = function (wallet, tx) {
  return new RawTx(wallet, tx)
}

/**
 * @param {Wallet} wallet
 * @param {coloredcoinjs-lib.ComposedTx} composedTx
 * @return {RawTx}
 */
RawTx.fromComposedTx = function (wallet, composedTx) {
  var tx = new bitcore.Transaction()

  composedTx.getInputs().forEach(function (input) {
    tx.from({
      txId: input.txid,
      outputIndex: input.oidx,
      script: bitcore.Script(input.script),
      satoshis: input.satoshis
    })
  })

  composedTx.getOutputs().forEach(function (output) {
    tx.addOutput(new bitcore.Transaction.Output({
      script: output.script,
      satoshis: output.value
    }))
  })

  return new RawTx(wallet, tx)
}

/**
 * @param {boolean} [allowIncomplete=false]
 * @return {bitcore.Transaction}
 */
RawTx.prototype.toTx = function (allowIncomplete) {
  if (!allowIncomplete && !this._tx.isFullySigned()) {
    throw new Error('Transaction not fully signed!')
  }

  return bitcore.Transaction(this._tx)
}

/**
 * @param {string} seed
 * @param {number[]} signingOnly
 * @return {Promise}
 */
RawTx.prototype.sign = function (seed, signingOnly) {
  var self = this
  return Promise.try(function () {
    // attempt sign all inputs
    if (signingOnly === undefined) {
      signingOnly = _.range(self._tx.inputs.length)
    }

    return Promise.map(signingOnly, function (index) {
      var input = self._tx.inputs[index]

      // input already signed?
      if (input.isFullySigned()) {
        return
      }

      return Promise.try(function () {
        // previous output for input already defined
        if (input.output !== undefined) {
          return
        }

        // get output from previous tx
        return self._wallet.getTx(input.prevTxId.toString('hex'))
          .then(function (rawtx) {
            input.output = bitcore.Transaction(rawtx).outputs[input.outputIndex]
          })
      })
      .then(function () {
        // get addresses for output
        var addresses = bitcoinUtil.script2addresses(
          input.output.script, self._wallet.bitcoinNetwork)
        // get private keys
        return Promise.map(addresses, function (address) {
          return self._wallet.addressManager.getPrivateKeyByAddress(seed, address)
        })
        .then(function (privateKeys) {
          // sign
          self._tx.sign(_.filter(privateKeys))
        })
      })
    })
  })
}

/**
 * @return {Promise.<coloredcoinjs-lib.ColorTarget[]>}
 */
RawTx.prototype.getColorTargets = function () {
  var self = this
  return Promise.map(self._tx.outputs, function (output, oidx) {
    var coin = {tx: self._tx, oidx: oidx}
    return self._wallet.coinManager.getCoinColorValue(coin)
      .then(function (colorValue) {
        var script = output.script.toString('hex')
        return new cclib.ColorTarget(script, colorValue)
      })
  })
}

/**
 * @param {coloredcoinjs-lib.ColorTarget[]} colorTargets
 * @param {boolean} [allowExtra=false]
 * @return {Promise.<boolean>}
 */
RawTx.prototype.satisfiesTargets = function (colorTargets, allowExtra) {
  var self = this
  return self.getColorTargets()
    .then(function (txColorTargets) {
      var lengthSatisfy = (
        (allowExtra && txColorTargets.length >= colorTargets.length) ||
        (!allowExtra && txColorTargets.length === colorTargets.length))
      if (!lengthSatisfy) {
        return false
      }

      function makeKey (ct) {
        return [ct.getScript(), ct.getColorId(), ct.getValue()].join(':')
      }

      var colorTargetsDiff = _.difference(
        colorTargets.map(makeKey), txColorTargets.map(makeKey))

      return colorTargetsDiff.length === 0
    })
}

/**
 * @param {number[]} oidxs
 * @return {Promise.<string[]>}
 */
RawTx.prototype.getInputAddresses = function (oidxs) {
  var self = this
  return Promise.try(function () {
    var rawtx = self._tx.toString()

    if (!_.Array(oidxs)) {
      oidxs = _.range(self._tx.outputs.length)
    }

    var fitx = cclib.tx.FilledInputs(rawtx, self._wallet.createGetTxFn())
    return Promise.map(self._tx.inputs, function (input, ii) {
      return fitx.getInputTx(ii)
        .then(function (inputTx) {
          return bitcoinUtil.script2addresses(
            inputTx.outputs[input.outputIndex],
            self._wallet.bitcoinNetwork)
        })
    })
    .then(function (data) {
      return _.uniq(_.flatten(data))
    })
  })
}

/**
 * @return {Promise.<string[]>}
 */
RawTx.prototype.getOutputAddresses = function () {
  var self = this
  return Promise.try(function () {
    var aaddresses = self._tx.outputs.map(function (output) {
      return bitcoinUtil.script2addresses(
        output.script, self._wallet.bitcoinNetwork)
    })
    return _.uniq(_.flatten(aaddresses))
  })
}

/**
 * @return {Promise.<string[]>} address
 */
RawTx.prototype.getOutputIndexesForAddress = function (address) {
  var self = this
  return Promise.try(function () {
    return self._tx.outputs.reduce(function (result, output, index) {
      var addresses = bitcoinUtil.script2addresses(
        output.script, self._wallet.bitcoinNetwork)
      if (addresses.indexOf(address) !== -1) {
        result.push(index)
      }

      return result
    })
  })
}

/**
 * @return {Promise.<ColorValues[]>}
 */
RawTx.prototype.getSentColorValues = function (wallet, cb) {
  var self = this
  return self._wallet.getAllAddresses()
    .then(function (walletAddresses) {
      var rawtx = self._tx.toString()
      var fitx = cclib.tx.FilledInputs(rawtx, self._wallet.createGetTxFn())
      return Promise.map(self._tx.inputs, function (input, ii) {
        return fitx.getInputTx(ii)
          .then(function (inputTx) {
            var addresses = bitcoinUtil.script2addresses(
              inputTx.outputs[input.outputIndex].script,
              self._wallet.bitcoinNetwork)
            if (_.intersection(walletAddresses, addresses).length === 0) {
              return
            }

            var coin = {tx: inputTx, oidx: input.outputIndex}
            return self._wallet.coinManager.getCoinColorValue(coin)
          })
      })
      .then(function (aColorValues) {
        return _.filter(aColorValues)
      })
    })
}

/**
 * @return {Promise.<ColorValues[]>}
 */
RawTx.prototype.getReceivedColorValues = function (wallet, cb) {
  var self = this
  return self._wallet.getAllAddresses()
    .then(function (walletAddresses) {
      return Promise.map(self._tx.outputs, function (output, oidx) {
        var addresses = bitcoinUtil.script2addresses(
          output.script, self._wallet.bitcoinNetwork)
        if (_.intersection(walletAddresses, addresses).length === 0) {
          return
        }

        var coin = {tx: self._tx, oidx: oidx}
        return self._wallet.coinManager.getCoinColorValue(coin)
      })
    })
    .then(function (aColorValues) {
      return _.filter(aColorValues)
    })
}

/**
 * @return {Promise.<ColorValue[]>}
 */
RawTx.prototype.getDeltaColorValues = function () {
  return Promise.all([
    this.getSentColorValues(),
    this.getReceivedColorValues()
  ])
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
}

/**
 * @param {ColorValue[]} deltas
 * @param {boolean} allowExtra
 * @return {Promise}
 */
RawTx.prototype.satisfiesDeltas = function (deltas, allowExtra) {
  return this.getDeltaColorValues()
    .then(function (txDeltas) {
      function deltasIdentity (colorValue) { return colorValue.getColorId() }

      var deltasMap = _.groupBy(deltas, deltasIdentity)
      var txDeltasMap = _.groupBy(txDeltas, deltasIdentity)
      var deltasIds = _.keys(deltasMap)
      var txDeltasIds = _.keys(txDeltasMap)

      // check that all delta colorvalues are in txDeltas
      if (_.intersection(deltasIds, txDeltasIds).length !== deltasIds.length) {
        throw new Error('Deltas not satisfied!')
      }

      // check for extra entries
      if (!allowExtra && _.difference(deltasIds, txDeltasIds).length !== 0) {
        throw new Error('Deltas not satisfied!')
      }

      // check values
      var isSatisfied = deltasIds.every(function (cid) {
        var value = cclib.ColorValue.sum(deltasMap[cid]).getValue()
        var txValue = cclib.ColorValue.sum(txDeltasMap[cid]).getValue()

        return ((allowExtra && value > txValue) || (!allowExtra && value !== txValue))
      })

      if (!isSatisfied) {
        throw new Error('Deltas not satisfied!')
      }
    })
}

module.exports = RawTx
