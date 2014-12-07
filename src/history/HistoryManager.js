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
var txStatus = require('../const').txStatus
var historyEntryType = require('../const').historyEntryType
var SyncMixin = require('../SyncMixin')


/**
 * @param {HistoryEntry[]}
 * @return {HistoryEntry[]}
 */
function toposort(entries) {
  var entriesIds = _.zipObject(entries.map(function (entry) { return [entry.getTxId(), entry] }))
  var result = []
  var resultIds = {}

  function sort(entry, topEntry) {
    if (resultIds[entry.getTxId()] === true) {
      return
    }

    entry.getTx().ins.forEach(function (input) {
      var inputId = Array.prototype.reverse.call(new Buffer(input.hash)).toString('hex')
      if (_.isUndefined(entriesIds[inputId])) {
        return
      }

      if (entriesIds[inputId].getTxId() === topEntry.getTxId()) {
        throw new Error('graph is cyclical')
      }

      sort(entriesIds[inputId], topEntry)
    })

    resultIds[entry.getTxId()] = true
    result.push(entry)
  }

  entries.forEach(function(entry) { sort(entry, entry) })

  return result
}

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
function HistoryManager(wallet) {
  verify.Wallet(wallet)

  var self = this
  events.EventEmitter.call(self)
  SyncMixin.call(self)

  self._wallet = wallet

  var txdb = self._wallet.getTxDb()

  txdb.on('addTx', self._addTx.bind(self))
  txdb.on('updateTx', self._updateTx.bind(self))
  txdb.on('revertTx', self._revertTx.bind(self))

  _.chain(txdb.getAllTxIds())
    .filter(function (txId) { return txStatus.isValid(txdb.getTxStatus(txId)) })
    .map(txdb.getTx.bind(txdb))
    .forEach(self._addTx.bind(self))

  self._historyEntries = []
}

inherits(HistoryManager, events.EventEmitter)

/**
 */
HistoryManager.prototype._resortHistoryEntries = function () {
  this._historyEntries = _.sortBy(this._historyEntries, function (entry) {
    if (entry.getBlockHeight() === 0) {
      return entry.getTimestamp()
    }

    return entry.getBlockHeight() + entry.getTimestamp()/10000000000
  })

  this._historyEntries = toposort(this._historyEntries)
}

/**
 * @param {Transaction} tx
 */
HistoryManager.prototype._addTx = function (tx) {
  verify.Transaction(tx)

  var self = this

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
        txId: tx.getId(),
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
    var assetValues = {}
    _.values(colorValues).forEach(function (cv) {
      var desc = cv.getColorDefinition().getDesc()
      var assetdef = self._wallet.getAssetDefinitionManager().getByDesc(desc)
      if (assetdef === null) {
        throw new Error('asset for ColorValue ' + cv + ' not found')
      }

      if (!_.isUndefined(assetValues[assetdef.getId()])) {
        throw new Error('multi asset not supported')
      }

      assetValues[assetdef.getId()] = new AssetValue(assetdef, cv.getValue())
    })

    function generateHistoryTargets(colorTargets) {
      return colorTargets.map(function (ct) {
        var desc = ct.getColorDefinition().getDesc()
        var assetdef = self._wallet.getAssetDefinitionManager().getByDesc(desc)
        if (assetdef === null) {
          throw new Error('asset for ColorValue ' + ct.getColorValue() + ' not found')
        }

        var assetValue = new AssetValue(assetdef, ct.getValue())
        return new HistoryTarget(assetValue, ct.getScript(), self._wallet.getBitcoinNetwork())
      })
    }

    var historyTargets
    var entryType
    if (myInsCount === 0) {
      entryType = historyEntryType.receive
      historyTargets = generateHistoryTargets(myColorTargets)
    } else {
      entryType = historyEntryType.send
      historyTargets = generateHistoryTargets(otherColorTargets)

    }

    if (myInsCount === tx.ins.length && myOutsCount === tx.outs.length) {
      entryType = historyEntryType.payment2yourself
    }

    var txId = tx.getId()
    self._historyEntries.push(new HistoryEntry({
      tx: tx,
      height: txdb.getTxHeight(txId),
      timestamp: txdb.getTxTimestamp(txId),
      isBlockTimestamp: txdb.isBlockTimestamp(txId),
      values: _.values(assetValues),
      targets: historyTargets,
      entryType: entryType
    }))
    self._resortHistoryEntries()
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
  this._historyEntries = this._historyEntries.map(function (entry) {
    if (entry.getTxId() !== txId) {
      return entry
    }

    return new HistoryEntry({
      tx: entry.getTx(),
      height: txdb.getTxHeight(txId),
      timestamp: txdb.getTxTimestamp(txId),
      isBlockTimestamp: txdb.isBlockTimestamp(txId),
      values: entry.getValues(),
      targets: entry.getTargets(),
      entryType: entry.getEntryType()
    })
  })
  this._resortHistoryEntries()
  this.emit('update')
}

/**
 * @param {Transaction} tx
 */
HistoryManager.prototype._revertTx = function (tx) {
  verify.Transaction(tx)

  var txId = tx.getId()
  this._historyEntries = this._historyEntries.filter(function (entry) {
    return entry.getTxId() !== txId
  })
  this.emit('update')
}

/**
 * @param {AssetDefinition} [assetdef]
 */
HistoryManager.prototype.getEntries = function (assetdef) {
  if (_.isUndefined(assetdef)) {
    return this._historyEntries
  }

  verify.AssetDefinition(assetdef)

  var assetId = assetdef.getId()
  return this._historyEntries.filter(function (entry) {
    var assetIds = entry.getTargets().map(function (at) { return at.getAsset().getId() })
    return assetIds.indexOf(assetId) !== -1
  })
}


module.exports = HistoryManager
