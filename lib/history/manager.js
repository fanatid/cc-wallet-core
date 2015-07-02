'use strict'

var _ = require('lodash')
var events = require('events')
var inherits = require('util').inherits
var bitcore = require('bitcore')
var cclib = require('coloredcoinjs-lib')
var Promise = require('bluebird')
var makeConcurrent = require('make-concurrent')(Promise)

var AssetValue = require('../assets/value')
var HistoryTarget = require('./target')
var HistoryEntry = require('./entry')
var HISTORY_ENTRY_TYPE = require('../util/const').HISTORY_ENTRY_TYPE
var bitcoinUtil = require('../util/bitcoin')

/**
 * @event HistoryManager#update
 */

/**
 * @class HistoryManager
 * @extends events.EventEmitter
 * @param {Wallet} wallet
 */
function HistoryManager (wallet) {
  events.EventEmitter.call(this)
  this._wallet = wallet

  this._historyEntries = []
  this._withLock = makeConcurrent(function (fn) { return fn() })
}

inherits(HistoryManager, events.EventEmitter)

/**
 * @private
 */
HistoryManager.prototype._resortHistoryEntries = function () {
  var self = this

  var sortedEntries = _.sortBy(self._historyEntries, function (entry) {
    if (entry.getBlockHeight() === null) {
      return entry.getTimestamp()
    }

    return entry.getBlockHeight() + entry.getTimestamp() / 10000000000
  })

  var historyEntries = []
  var indexedEntries = _.indexBy(sortedEntries, function (entry) {
    return entry.getTxId()
  })
  var sortedTxIds = {}

  function sort (entry, topEntry) {
    if (sortedTxIds[entry.getTxId()] !== undefined) {
      return
    }

    entry.getTx().inputs.forEach(function (input) {
      var inputTxId = input.prevTxId.toString('hex')
      if (indexedEntries[inputTxId] === undefined) {
        return
      }

      if (indexedEntries[inputTxId].getTxId() === topEntry.getTxId()) {
        throw new Error('Graph is cyclical')
      }

      sort(indexedEntries[inputTxId], topEntry)
    })

    sortedTxIds[entry.getTxId()] = true
    historyEntries.push(entry)
  }

  sortedEntries.forEach(function (entry) { sort(entry, entry) })
  self._historyEntries = historyEntries
}

/**
 * @param {ITxStorage~Record} info
 * @return {Promise}
 */
HistoryManager.prototype._addTx = function (info) {
  var self = this
  return self._withLock(function () {
    var bitcoinNetwork = self._wallet.bitcoinNetwork
    var tx = bitcore.Transaction(info.rawtx)

    var myInputsCount = 0
    var myOutputsCount = 0
    var myColorTargets = []
    var otherColorTargets = []

    return self._wallet.getAllAddresses()
      .then(function (walletAddresses) {
        var getTxFn = self._wallet.createGetTxFn()
        var fitx = new cclib.tx.FilledInputs(info.rawtx, getTxFn)
        return Promise.map(tx.inputs, function (input, ii) {
          return fitx.getInputTx(ii)
            .then(function (inputTx) {
              var addresses = bitcoinUtil.script2addresses(
                inputTx.outputs[input.outputIndex].script, bitcoinNetwork)

              if (_.intersection(walletAddresses, addresses).length === 0) {
                return
              }

              myInputsCount += 1

              var coin = {tx: inputTx, oidx: input.outputIndex}
              return self._wallet.coinManager.getCoinColorValue(coin)
            })
        })
        .then(function (inColorValues) {
          return Promise.map(tx.outputs, function (output, oidx) {
            var coin = {tx: tx, oidx: oidx}
            return self._wallet.coinManager.getCoinColorValue(coin)
              .then(function (colorValue) {
                var colorTarget = new cclib.ColorTarget(
                  output.script.toHex(), colorValue)

                var addresses = bitcoinUtil.script2addresses(
                  output.script, bitcoinNetwork)
                if (_.intersection(walletAddresses, addresses).length === 0) {
                  otherColorTargets.push(colorTarget)
                  return
                }

                myOutputsCount += 1
                myColorTargets.push(colorTarget)

                return colorValue
              })
          })
          .then(function (outColorValues) {
            return _.chain(_.filter(inColorValues))
              .invoke('neg')
              .concat(_.filter(outColorValues))
              .groupBy(function (colorValue) {
                return colorValue.getColorId()
              })
              .map(function (colorValues) {
                return cclib.ColorValue.sum(colorValues)
              })
              .value()
          })
        })
      })
      .then(function (colorValues) {
        var assetValues = {}
        return Promise.map(colorValues, function (colorValue) {
          var cdesc = colorValue.getColorDefinition().getDesc()
          return self._wallet.assetManager.get({cdesc: cdesc})
            .then(function (adef) {
              if (adef === null) {
                throw new Error('Asset not found for color desc: ' + cdesc)
              }

              var aid = adef.getId()
              if (assetValues[aid] !== undefined) {
                throw new Error('Multi-asset transaction not supported')
              }

              assetValues[aid] = new AssetValue(adef, colorValue.getValue())
            })
        })
        .then(function () {
          var colorTargets = myInputsCount === 0
                               ? myColorTargets
                               : otherColorTargets
          return Promise.map(colorTargets, function (colorTarget) {
            var cdesc = colorTarget.getColorDefinition().getDesc()
            return self._wallet.assetManager.get({cdesc: cdesc})
              .then(function (adef) {
                if (adef === null) {
                  throw new Error('Asset not found for color desc: ' + cdesc)
                }

                var assetValue = new AssetValue(adef, colorTarget.getValue())
                var script = colorTarget.getScript()
                return new HistoryTarget(assetValue, script, bitcoinNetwork)
              })
          })
        })
        .then(function (historyTargets) {
          var entryType = HISTORY_ENTRY_TYPE.send
          if (myInputsCount === 0) {
            entryType = HISTORY_ENTRY_TYPE.receive
          }
          if (myInputsCount === tx.inputs.length &&
              myOutputsCount === tx.outputs.length) {
            entryType = HISTORY_ENTRY_TYPE.payment2yourself
          }

          var data = _.defaults({
            values: _.values(assetValues),
            targets: historyTargets,
            entryType: entryType
          }, info)

          self._historyEntries.push(new HistoryEntry(data))

          self._resortHistoryEntries()
          self.emit('update')
        })
      })
  })
}

/**
 * @param {ITxStorage~Record} info
 * @return {Promise}
 */
HistoryManager.prototype.loadTx = function (info) {
  return this._addTx(info)
}

/**
 * @param {ITxStorage~Record} info
 * @return {Promise}
 */
HistoryManager.prototype.addTx = function (info) {
  return this._addTx(info)
}

/**
 * @param {ITxStorage~Record} info
 * @return {Promise}
 */
HistoryManager.prototype.updateTx = function (info) {
  var self = this
  return self._withLock(function () {
    var isChanged = false
    self._historyEntries.some(function (entries) {
      if (entries.getTxId() !== info.txid) {
        return false
      }

      if (entries.getTxStatus() !== info.status ||
          entries.getBlockHeight() !== info.blockHeight) {
        entries.update(info)
        isChanged = true
      }

      return true
    })

    if (isChanged) {
      self._resortHistoryEntries()
      self.emit('update')
    }
  })
}

/**
 * @param {ITxStorage~Record} info
 * @return {Promise}
 */
HistoryManager.prototype.removeTx = function (info) {
  var self = this
  return self._withLock(function () {
    var entriesLength = self._historyEntries.length

    self._historyEntries = self._historyEntries.filter(function (entry) {
      return entry.txid !== info.txid
    })

    if (entriesLength !== self._historyEntries.length) {
      self.emit('update')
    }
  })
}

/**
 * @param {AssetDefinition} [adef]
 * @return {Promise.<HistoryEntry[]>}
 */
HistoryManager.prototype.getEntries = function (adef) {
  var self = this
  return self._withLock(function () {
    if (adef === undefined) {
      return self._historyEntries.slice()
    }

    var assetId = adef.getId()
    return self._historyEntries.filter(function (entry) {
      var assetIds = _.invoke(entry.getValues(), 'getId')
      return assetIds.indexOf(assetId) !== -1
    })
  })
}

module.exports = HistoryManager
