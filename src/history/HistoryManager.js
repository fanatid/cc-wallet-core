var events = require('events')
var inherits = require('util').inherits

var _ = require('lodash')
var Q = require('q')

var cclib = require('../cclib')
var bitcoin = require('../bitcoin')
var AssetValue = require('../asset').AssetValue
var HistoryTarget = require('./HistoryTarget')
var Coin = require('../coin').Coin
var HistoryEntry = require('./HistoryEntry')
var verify = require('../verify')
var historyEntryType = require('../const').historyEntryType


/**
 * @param {{txId1: string, txIdN:string}[]} entries
 * @param {function} getTxFn
 * @return {{txId1: string, txIdN:string}[]}
 */
function toposort(entries, getTxFn) {
  var entriesTxIds = _.zipObject(entries.map(function (entry) { return [entry.txId, entry] }))
  var result = []
  var resultTxIds = {}

  function sort(entry, topEntry) {
    if (resultTxIds[entry.txId] === true) {
      return
    }

    getTxFn(entry.txId).ins.forEach(function (input) {
      var inputId = Array.prototype.reverse.call(new Buffer(input.hash)).toString('hex')
      if (_.isUndefined(entriesTxIds[inputId])) {
        return
      }

      if (entriesTxIds[inputId].txId === topEntry.txId) {
        throw new Error('graph is cyclical')
      }

      sort(entriesTxIds[inputId], topEntry)
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
 * @extends events.EventEmitter
 * @param {Wallet} wallet
 * @param {TxManager} txManager
 * @param {CoinManager} coinManager
 * @param {Object} rawStorage
 */
function HistoryManager(wallet, txManager, coinManager, rawStorage) {
  verify.Wallet(wallet)
  verify.TxManager(txManager)
  verify.CoinManager(coinManager)
  verify.object(rawStorage)

  var self = this
  events.EventEmitter.call(self)

  self._wallet = wallet
  self._txManager = txManager
  self._coinManager = coinManager
  self._historyRecords = rawStorage
}

inherits(HistoryManager, events.EventEmitter)

/**
 */
HistoryManager.prototype._resortHistoryRecords = function () {
  var self = this

  var orderedRecords = _.sortBy(self._historyRecords, function (record) {
    var txData = self._txManager.getTxData(record.txId)
    if (txData.height === 0) {
      return txData.timestamp
    }

    return txData.height + txData.timestamp / 10000000000
  })

  var getTxFn = self._txManager.getTx.bind(self._txManager)
  toposort(orderedRecords, getTxFn).forEach(function (record, index) {
    self._historyRecords[index] = record
  })
}

/**
 * @param {Transaction} tx
 * @return {Q.Promise}
 */
HistoryManager.prototype.addTx = function (tx) {
  verify.Transaction(tx)

  var self = this
  var txId = tx.getId()

  var bs = self._wallet.getBlockchain()
  var walletAddresses = self._wallet.getAllAddresses()
  var network = self._wallet.getBitcoinNetwork()
  var colorValues = {}
  var otherColorTargets = []
  var myColorTargets = []
  var myInsCount = 0
  var myOutsCount = 0

  return Q.ninvoke(tx, 'ensureInputValues', bs.getTx.bind(bs)).then(function (ensuredInputsTx) {
    tx = ensuredInputsTx
    return Q.all(tx.ins.map(function (input) {
      // @todo Add multisig support (multi-address)
      var address = bitcoin.getAddressesFromOutputScript(
        input.prevTx.outs[input.index].script, self._wallet.getBitcoinNetwork())[0]

      if (walletAddresses.indexOf(address) === -1) {
        return
      }

      myInsCount += 1

      var coin = new Coin(self._coinManager, {
        txId: input.prevTx.getId(),
        outIndex: input.index,
        value: input.prevTx.outs[input.index].value,
        script: input.prevTx.outs[input.index].script.toHex(),
        address: address
      })

      return Q.ninvoke(coin, 'getMainColorValue').then(function (cv) {
        var cid = cv.getColorId()
        if (_.isUndefined(colorValues[cid])) {
          colorValues[cid] = cv.neg()

        } else {
          colorValues[cid] = colorValues[cid].minus(cv)

        }
      })
    }))

  }).then(function () {
    return self._coinManager.getTxMainColorValues(tx).then(function (txColorValues) {
      txColorValues.forEach(function (colorValue, index) {
        var colorTarget = new cclib.ColorTarget(tx.outs[index].script.toHex(), colorValue)

        var touchedAddresses = bitcoin.getAddressesFromOutputScript(tx.outs[index].script, network)
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

    var entryType = historyEntryType.send
    if (myInsCount === 0) {
      entryType = historyEntryType.receive

    } else if (myInsCount === tx.ins.length && myOutsCount === tx.outs.length) {
      entryType = historyEntryType.payment2yourself

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
 * @param {Transaction} tx
 * @return {Q.Promise}
 */
HistoryManager.prototype.updateTx = function () {
  this._resortHistoryRecords()
  return Q()
}

/**
 * @param {Transaction} tx
 * @return {Q.Promise}
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
 * @throws {Error}
 */
HistoryManager.prototype.getEntries = function (assetdef) {
  var assetDefinitionManager = this._wallet.getAssetDefinitionManager()
  var bitcoinNetwork = this._wallet.getBitcoinNetwork()
  var txManager = this._txManager

  var assetId = null
  if (!_.isUndefined(assetdef)) {
    verify.AssetDefinition(assetdef)
    assetId = assetdef.getId()
  }

  var entries = this._historyRecords.map(function (record) {
    var tx = txManager.getTx(record.txId)
    if (tx === null) {
      throw new Error('NotFoundTx: ' + record.txId)
    }

    var assetValues = {}
    record.values.forEach(function (rv) {
      var assetdef = assetDefinitionManager.getByDesc(rv.desc)
      if (assetdef === null) {
        throw new Error('asset for color description: ' + rv.desc + ' not found')
      }

      var assetId = assetdef.getId()
      if (!_.isUndefined(assetValues[assetId])) {
        throw new Error('multi asset transactions not supported')
      }

      assetValues[assetId] = new AssetValue(assetdef, rv.value)
    })

    if (assetId !== null && _.keys(assetValues).indexOf(assetId) === -1) {
      return
    }

    var historyTargets = record.targets.map(function (rt) {
      var assetdef = assetDefinitionManager.getByDesc(rt.desc)
      if (assetdef === null) {
        throw new Error('asset for color description ' + rt.desc + ' not found')
      }

      var assetValue = new AssetValue(assetdef, rt.value)
      return new HistoryTarget(assetValue, rt.script, bitcoinNetwork)
    })

    var txData = txManager.getTxData(record.txId)
    var entry = new HistoryEntry({
      tx: tx,
      height: txData.height,
      timestamp: txData.timestamp,
      isBlockTimestamp: txData.isBlockTimestamp,
      values: _.values(assetValues),
      targets: historyTargets,
      entryType: record.entryType
    })

    return entry
  })

  return _.filter(entries)
}


module.exports = HistoryManager
