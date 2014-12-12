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
var util = require('../util')
var verify = require('../verify')
var txStatus = require('../const').txStatus
var historyEntryType = require('../const').historyEntryType


/**
 * @event HistoryManager#error
 * @param {Error} error
 */

/**
 * @event HistoryManager#update
 */

/**
 * @event HistoryManager#syncStart
 */

/**
 * @event HistoryManager#syncStop
 */

/**
 * @class HistoryManager
 * @extends events.EventEmitter
 * @mixes SyncMixin
 * @param {Wallet} wallet
 * @param {HistoryStorage} storage
 */
function HistoryManager(wallet, storage) {
  verify.Wallet(wallet)
  verify.HistoryStorage(storage)

  var self = this
  events.EventEmitter.call(self)
  util.SyncMixin.call(self)

  self._wallet = wallet
  self._storage = storage

  self._historyEntriesCache = {}

  var txdb = self._wallet.getTxDb()
  txdb.on('addTx', self._addTx.bind(self))
  txdb.on('updateTx', self._updateTx.bind(self))
  txdb.on('revertTx', self._revertTx.bind(self))
  _.chain(txdb.getAllTxIds())
    .filter(function (txId) { return txStatus.isValid(txdb.getTxStatus(txId)) })
    .map(txdb.getTx.bind(txdb))
    .map(self._addTx.bind(self))
}

inherits(HistoryManager, events.EventEmitter)

/**
 * @param {Transaction} tx
 */
HistoryManager.prototype._addTx = function (tx) {
  verify.Transaction(tx)
  var txId = tx.getId()

  var self = this
  if (self._storage.has(txId)) {
    return
  }

  self._syncEnter()

  var bs = self._wallet.getBlockchain()
  var coinManager = self._wallet.getCoinManager()
  var txdb = self._wallet.getTxDb()
  var walletAddresses = self._wallet.getAllAddresses()
  var colorValues = {}
  var otherColorTargets = []
  var myColorTargets = []
  var myInsCount = 0
  var myOutsCount = 0

  Q.ninvoke(tx, 'ensureInputValues', bs.getTx.bind(bs)).then(function (ensuredInputValuesTx) {
    tx = ensuredInputValuesTx
    return Q.all(tx.ins.map(function (input) {
      // @todo Add multisig support (multi-address)
      var address = bitcoin.getAddressesFromOutputScript(
        input.prevTx.outs[input.index].script, self._wallet.getBitcoinNetwork())[0]

      if (walletAddresses.indexOf(address) === -1) {
        return
      }

      myInsCount += 1

      var coin = new Coin(coinManager, {
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
    return Q.all(tx.outs.map(function (output, index) {
      var address = bitcoin.getAddressesFromOutputScript(
        output.script, self._wallet.getBitcoinNetwork())[0]

      var coin = new Coin(coinManager, {
        txId: txId,
        outIndex: index,
        value: output.value,
        script: output.script.toHex(),
        address: address
      })

      return Q.ninvoke(coin, 'getMainColorValue').then(function (cv) {
        var colorTarget = new cclib.ColorTarget(output.script.toHex(), cv)

        if (walletAddresses.indexOf(address) === -1) {
          return otherColorTargets.push(colorTarget)
        }

        myOutsCount += 1
        myColorTargets.push(colorTarget)

        var cid = cv.getColorId()
        if (_.isUndefined(colorValues[cid])) {
          colorValues[cid] = cv

        } else {
          colorValues[cid] = colorValues[cid].plus(cv)

        }
      })
    }))

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

    self._storage.add({
      txId: txId,
      tx: tx.toHex(),
      height: txdb.getTxHeight(txId),
      timestamp: txdb.getTxTimestamp(txId),
      isBlockTimestamp: txdb.isBlockTimestamp(txId),
      values: colorValues,
      targets: historyTargets,
      entryType: entryType
    })

    self.emit('update')

  }).catch(function (error) {
    self.emit('error', error)

  }).finally(function () {
    self._syncExit()

  })
}

/**
 * @param {Transaction} tx
 */
HistoryManager.prototype._updateTx = function (tx) {
  verify.Transaction(tx)

  var txId = tx.getId()
  var txdb = this._wallet.getTxDb()
  this._storage.update(txId, {
    height: txdb.getTxHeight(txId),
    timestamp: txdb.getTxTimestamp(txId),
    isBlockTimestamp: txdb.isBlockTimestamp(txId),
  })
  delete this._historyEntriesCache[txId]
  this.emit('update')
}

/**
 * @param {Transaction} tx
 */
HistoryManager.prototype._revertTx = function (tx) {
  verify.Transaction(tx)

  var txId = tx.getId()
  this._storage.remove(txId)
  delete this._historyEntriesCache[txId]
  this.emit('update')
}

/**
 * @param {AssetDefinition} [assetdef]
 * @throws {Error}
 */
HistoryManager.prototype.getEntries = function (assetdef) {
  var assetDefinitionManager = this._wallet.getAssetDefinitionManager()
  var bitcoinNetwork = this._wallet.getBitcoinNetwork()
  var entriesCache = this._historyEntriesCache
  var storage = this._storage

  var assetId = null
  if (!_.isUndefined(assetdef)) {
    verify.AssetDefinition(assetdef)
    assetId = assetdef.getId()
  }

  var entries = storage.getAllTxIds().map(function (txId) {
    if (_.isUndefined(entriesCache[txId])) {
      var record = storage.get(txId)

      var assetValues = {}
      record.values.forEach(function (rv) {
        var assetdef = assetDefinitionManager.getByDesc(rv.desc)
        if (assetdef === null) {
          throw new Error('asset for color description: ' + rv.desc + ' not found')
        }

        if (!_.isUndefined(assetValues[assetdef.getId()])) {
          throw new Error('multi asset transactions not supported')
        }

        assetValues[assetdef.getId()] = new AssetValue(assetdef, rv.value)
      })

      var historyTargets = record.targets.map(function (rt) {
        var assetdef = assetDefinitionManager.getByDesc(rt.desc)
        if (assetdef === null) {
          throw new Error('asset for color description ' + rt.desc + ' not found')
        }

        var assetValue = new AssetValue(assetdef, rt.value)
        return new HistoryTarget(assetValue, rt.script, bitcoinNetwork)
      })

      var entry = new HistoryEntry({
        tx: bitcoin.Transaction.fromHex(record.tx),
        height: record.height,
        timestamp: record.timestamp,
        isBlockTimestamp: record.isBlockTimestamp,
        values: _.values(assetValues),
        targets: historyTargets,
        entryType: record.entryType
      })

      entriesCache[txId] = {entry: entry, assetIds: _.keys(assetValues)}
    }

    if (assetId === null || entriesCache[txId].assetIds.indexOf(assetId) !== -1) {
      return entriesCache[txId].entry
    }
  })

  return _.filter(entries)
}


module.exports = HistoryManager
