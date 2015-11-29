var events = require('events')
var inherits = require('util').inherits
var _ = require('lodash')
var Q = require('q')
var cclib = require('coloredcoinjs-lib')
var script2addresses = require('script2addresses')

var errors = require('../errors')
var AssetValue = require('../asset').AssetValue
var HistoryTarget = require('./HistoryTarget')
var HistoryEntry = require('./HistoryEntry')
var HISTORY_ENTRY_TYPE = require('../util/const').HISTORY_ENTRY_TYPE

/**
 * @event HistoryManager#update
 */

/**
 * @class HistoryManager
 * @extends events.EventEmitter
 * @param {Wallet} wallet
 * @param {WalletState} walletState
 * @param {Object} rawStorage
 */
function HistoryManager (wallet, walletState, rawStorage) {
  events.EventEmitter.call(this)

  rawStorage = _.defaults(rawStorage, {records: [], version: 1})

  this._wallet = wallet
  this._walletState = walletState
  this._historyRecords = rawStorage.records
}

inherits(HistoryManager, events.EventEmitter)

/**
 * @private
 */
HistoryManager.prototype._resortHistoryRecords = function () {
  var self = this
  var txManager = self._walletState.getTxManager()

  var orderedRecords = _.sortBy(self._historyRecords, function (record) {
    var txData = self._walletState.getTxManager().getTxData(record.txId)
    if (txData.height === 0) {
      return txData.timestamp
    }

    return txData.height + txData.timestamp / 10000000000
  })

  var entriesTxIds = _.zipObject(orderedRecords.map(function (entry) {
    return [entry.txId, entry]
  }))

  var result = []
  var resultTxIds = {}

  function sort (entry, topEntry) {
    if (resultTxIds[entry.txId] === true) {
      return
    }

    txManager.getTx(entry.txId).inputs.forEach(function (input) {
      var inputTxId = input.prevTxId.toString('hex')
      if (_.isUndefined(entriesTxIds[inputTxId])) {
        return
      }

      if (entriesTxIds[inputTxId].txId === topEntry.txId) {
        throw new errors.ToposortError('Graph is cyclical')
      }

      sort(entriesTxIds[inputTxId], topEntry)
    })

    resultTxIds[entry.txId] = true
    result.push(entry)
  }

  orderedRecords.forEach(function (entry) {
    sort(entry, entry)
  })

  result.forEach(function (record, index) {
    self._historyRecords[index] = record
  })
}

/**
 * @param {bitcore.Transaction} tx
 * @return {Promise}
 */
HistoryManager.prototype.addTx = function (tx) {
  var self = this
  var txId = tx.id

  var wsm = self._wallet.getStateManager()
  var blockchain = self._wallet.getBlockchain()
  var getTxFn = blockchain.getTx.bind(blockchain)
  var walletAddresses = self._wallet.getAllAddresses()
  var network = self._wallet.getBitcoinNetwork()
  var colorValues = {}
  var otherColorTargets = []
  var myColorTargets = []
  var myInsCount = 0
  var myOutsCount = 0

  var bitcoinNetwork = self._wallet.getBitcoinNetwork()
  var ftx = new cclib.tx.FilledInputs(tx, getTxFn)
  return Q.all(tx.inputs.map(function (input, inputIndex) {
    return ftx.getInputTx(inputIndex)
      .then(function (inputTx) {
        var output = inputTx.outputs[input.outputIndex]

        // @todo Add multisig support (multi-address)
        var address = script2addresses(output.script.toBuffer(), bitcoinNetwork).addresses[0]

        if (walletAddresses.indexOf(address) === -1) {
          return
        }

        myInsCount += 1

        var coin = {
          txId: input.prevTxId.toString('hex'),
          outIndex: input.outputIndex,
          value: output.satoshis
        }

        return Q.ninvoke(wsm, 'getCoinMainColorValue', coin)
          .then(function (cv) {
            var cid = cv.getColorId()
            if (_.isUndefined(colorValues[cid])) {
              colorValues[cid] = cv.neg()
            } else {
              colorValues[cid] = colorValues[cid].minus(cv)
            }
          })
      })
  }))
  .then(function () {
    var wsm = self._wallet.getStateManager()
    return Q.ninvoke(wsm, 'getTxMainColorValues', tx, self._walletState)
      .then(function (txColorValues) {
        txColorValues.forEach(function (colorValue, outputIndex) {
          var outputScript = tx.outputs[outputIndex].script

          var colorTarget = new cclib.ColorTarget(outputScript.toHex(), colorValue)

          var touchedAddresses = script2addresses(outputScript.toBuffer(), network).addresses
          if (_.intersection(walletAddresses, touchedAddresses).length === 0) {
            return otherColorTargets.push(colorTarget)
          }

          myOutsCount += 1
          myColorTargets.push(colorTarget)

          var cid = colorValue.getColorId()
          if (_.isUndefined(colorValues[cid])) {
            colorValues[cid] = colorValue
          } else {
            colorValues[cid] = colorValues[cid].plus(colorValue)
          }
        })
      })
  })
  .then(function () {
    colorValues = _.values(colorValues).map(function (cv) {
      return {desc: cv.getColorDefinition().getDesc(), value: cv.getValue()}
    })

    var historyTargets = (myInsCount === 0 ? myColorTargets : otherColorTargets).map(function (ct) {
      return {desc: ct.getColorDefinition().getDesc(), value: ct.getValue(), script: ct.getScript()}
    })

    var entryType = HISTORY_ENTRY_TYPE.send
    if (myInsCount === 0) {
      entryType = HISTORY_ENTRY_TYPE.receive
    } else if (myInsCount === tx.inputs.length && myOutsCount === tx.outputs.length) {
      entryType = HISTORY_ENTRY_TYPE.payment2yourself
    }

    self._historyRecords.push({
      txId: txId,
      values: colorValues,
      targets: historyTargets,
      entryType: entryType
    })

    self._resortHistoryRecords()

    self.emit('update')
  })
}

/**
 * @param {bitcore.Transaction} tx
 * @return {Promise}
 */
HistoryManager.prototype.updateTx = function () {
  this._resortHistoryRecords()
  return Q.resolve()
}

/**
 * @param {bitcore.Transaction} tx
 * @return {Promise}
 */
HistoryManager.prototype.revertTx = function (tx) {
  var savedLength = this._historyRecords.length
  var txId = tx.id
  this._historyRecords = this._historyRecords.filter(function (record) {
    return record.txId !== txId
  })

  if (savedLength !== this._historyRecords.length) {
    this.emit('update')
  }
}

/**
 * @param {AssetDefinition} [assetdef]
 * @return {HistoryEntry[]}
 * @throws {(TxNotFoundError|AssetNotFoundError|MultiAssetTransactionNotSupportedError)}
 */
HistoryManager.prototype.getEntries = function (assetdef) {
  var assetDefinitionManager = this._wallet.getAssetDefinitionManager()
  var bitcoinNetwork = this._wallet.getBitcoinNetwork()
  var txManager = this._walletState.getTxManager()

  var assetId = null
  if (!_.isUndefined(assetdef)) {
    assetId = assetdef.getId()
  }

  var entries = this._historyRecords.map(function (record) {
    var tx = txManager.getTx(record.txId)
    if (tx === null) {
      throw new errors.TxNotFoundError('TxId: ' + record.txId)
    }

    var assetValues = {}
    record.values.forEach(function (rv) {
      var assetdef = assetDefinitionManager.getByDesc(rv.desc)
      if (assetdef === null) {
        // TODO
        // throw new errors.AssetNotFoundError('Color description: ' + rv.desc)
        console.error('Asset not found! Color descriptor: ' + rv.desc)
        return
      }

      var assetId = assetdef.getId()
      if (!_.isUndefined(assetValues[assetId])) {
        throw new errors.MultiAssetTransactionNotSupportedError('TxId: ' + tx.id)
      }

      assetValues[assetId] = new AssetValue(assetdef, rv.value)
    })

    if (assetId !== null && _.keys(assetValues).indexOf(assetId) === -1) {
      return
    }

    var historyTargets = _.filter(record.targets.map(function (rt) {
      var assetdef = assetDefinitionManager.getByDesc(rt.desc)
      if (assetdef === null) {
        // TODO
        // throw new errors.AssetNotFoundError('Color description: ' + rt.desc)
        console.error('Asset not found! Color descriptor: ' + rt.desc)
        return
      }

      var assetValue = new AssetValue(assetdef, rt.value)
      return new HistoryTarget(assetValue, rt.script, bitcoinNetwork)
    }))

    var entry = new HistoryEntry({
      tx: tx,
      txData: txManager.getTxData(record.txId),
      values: _.values(assetValues),
      targets: historyTargets,
      entryType: record.entryType
    })

    return entry
  })

  return _.filter(entries)
}

module.exports = HistoryManager
