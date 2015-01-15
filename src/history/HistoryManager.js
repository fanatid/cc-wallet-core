var events = require('events')
var inherits = require('util').inherits

var _ = require('lodash')
var Q = require('q')

var cclib = require('../cclib')
var bitcoin = require('../bitcoin')
var errors = require('../errors')
var AssetValue = require('../asset').AssetValue
var HistoryTarget = require('./HistoryTarget')
var HistoryEntry = require('./HistoryEntry')
var verify = require('../verify')
var HISTORY_ENTRY_TYPE = require('../const').HISTORY_ENTRY_TYPE


/**
 * @private
 * @param {Array.<{txId1: string, txIdN:string}>} entries
 * @param {TxManager} txManager
 * @return {Array.<{txId1: string, txIdN:string}>}
 */
function toposort(entries, txManager) {
  var entriesTxIds = _.zipObject(entries.map(function (entry) { return [entry.txId, entry] }))
  var result = []
  var resultTxIds = {}

  function sort(entry, topEntry) {
    if (resultTxIds[entry.txId] === true) {
      return
    }

    txManager.getTx(entry.txId).ins.forEach(function (input) {
      var inputTxId = bitcoin.util.hashEncode(input.hash)
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

  entries.forEach(function (entry) { sort(entry, entry) })

  return result
}


/**
 * @event HistoryManager#update
 */

/**
 * @class HistoryManager
 * @extends external:events.EventEmitter
 * @param {Wallet} wallet
 * @param {WalletState} walletState
 * @param {Object} rawStorage
 */
function HistoryManager(wallet, walletState, rawStorage) {
  verify.Wallet(wallet)
  verify.WalletState(walletState)
  verify.object(rawStorage)

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

  var orderedRecords = _.sortBy(self._historyRecords, function (record) {
    var txData = self._walletState.getTxManager().getTxData(record.txId)
    if (txData.height === 0) {
      return txData.timestamp
    }

    return txData.height + txData.timestamp / 10000000000
  })

  toposort(orderedRecords, self._walletState.getTxManager()).forEach(function (record, index) {
    self._historyRecords[index] = record
  })
}

/**
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 * @return {external:Q.Promise}
 */
HistoryManager.prototype.addTx = function (tx) {
  verify.Transaction(tx)

  var self = this
  var txId = tx.getId()

  var wsm = self._wallet.getStateManager()
  var getTxFn = self._wallet.getBlockchain().getTxFn()
  var walletAddresses = self._wallet.getAllAddresses()
  var network = self._wallet.getBitcoinNetwork()
  var colorValues = {}
  var otherColorTargets = []
  var myColorTargets = []
  var myInsCount = 0
  var myOutsCount = 0

  return Q.ninvoke(tx, 'ensureInputValues', getTxFn).then(function (ensuredTx) {
    tx = ensuredTx
    return Q.all(tx.ins.map(function (input) {
      // @todo Add multisig support (multi-address)
      var address = bitcoin.util.getAddressesFromScript(
        input.prevTx.outs[input.index].script, self._wallet.getBitcoinNetwork())[0]

      if (walletAddresses.indexOf(address) === -1) {
        return
      }

      myInsCount += 1

      var coin = {
        txId: input.prevTx.getId(),
        outIndex: input.index,
        value: input.prevTx.outs[input.index].value
      }

      return Q.ninvoke(wsm, 'getCoinMainColorValue', coin).then(function (cv) {
        var cid = cv.getColorId()
        if (_.isUndefined(colorValues[cid])) {
          colorValues[cid] = cv.neg()

        } else {
          colorValues[cid] = colorValues[cid].minus(cv)

        }
      })
    }))

  }).then(function () {
    var wsm = self._wallet.getStateManager()
    return Q.ninvoke(wsm, 'getTxMainColorValues', tx, self._walletState).then(function (txColorValues) {
      txColorValues.forEach(function (colorValue, index) {
        var colorTarget = new cclib.ColorTarget(tx.outs[index].script.toHex(), colorValue)

        var touchedAddresses = bitcoin.util.getAddressesFromScript(tx.outs[index].script, network)
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

  }).then(function () {
    colorValues = _.values(colorValues).map(function (cv) {
      return {desc: cv.getColorDefinition().getDesc(), value: cv.getValue()}
    })

    var historyTargets = (myInsCount === 0 ? myColorTargets : otherColorTargets).map(function (ct) {
      return {desc: ct.getColorDefinition().getDesc(), value: ct.getValue(), script: ct.getScript()}
    })

    var entryType = HISTORY_ENTRY_TYPE.send
    if (myInsCount === 0) {
      entryType = HISTORY_ENTRY_TYPE.receive

    } else if (myInsCount === tx.ins.length && myOutsCount === tx.outs.length) {
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
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 * @return {external:Q.Promise}
 */
HistoryManager.prototype.updateTx = function () {
  this._resortHistoryRecords()
  return Q()
}

/**
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 * @return {external:Q.Promise}
 */
HistoryManager.prototype.revertTx = function (tx) {
  verify.Transaction(tx)

  var savedLength = this._historyRecords.length
  var txId = tx.getId()
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
    verify.AssetDefinition(assetdef)
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
        throw new errors.AssetNotFoundError('Color description: ' + rv.desc)
      }

      var assetId = assetdef.getId()
      if (!_.isUndefined(assetValues[assetId])) {
        throw new errors.MultiAssetTransactionNotSupportedError('TxId: ' + tx.getId())
      }

      assetValues[assetId] = new AssetValue(assetdef, rv.value)
    })

    if (assetId !== null && _.keys(assetValues).indexOf(assetId) === -1) {
      return
    }

    var historyTargets = record.targets.map(function (rt) {
      var assetdef = assetDefinitionManager.getByDesc(rt.desc)
      if (assetdef === null) {
        throw new errors.AssetNotFoundError('Color description: ' + rt.desc)
      }

      var assetValue = new AssetValue(assetdef, rt.value)
      return new HistoryTarget(assetValue, rt.script, bitcoinNetwork)
    })

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
