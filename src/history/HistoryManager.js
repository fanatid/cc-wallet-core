var _ = require('lodash')
var Q = require('q')

var cclib = require('../cclib')
var bitcoin = require('../bitcoin')
var AssetValue = require('../asset').AssetValue
var HistoryTarget = require('./HistoryTarget')
var Coin = require('../coin').Coin
var toposort = require('../tx').toposort
var HistoryEntry = require('./HistoryEntry')
var verify = require('../verify')
var historyEntryType = require('../const').historyEntryType


/**
 * @class HistoryManager
 *
 * @param {Wallet} wallet
 */
function HistoryManager(wallet) {
  verify.Wallet(wallet)

  var self = this

  self._wallet = wallet
  self._entries = []
  self._needUpdating = 1
  self._updatePromise = null

  self._wallet.getCoinManager().on('touchAsset', function () { self._needUpdating += 1 })
}

/**
 * @return {Q.Promise}
 */
HistoryManager.prototype._updateEntries = function () {
  var self = this
  self._entries = []

  var currentNeedUpdating = self._needUpdating
  var coinQuery = self._wallet.getCoinQuery().includeSpent().includeUnconfirmed()

  return Q.ninvoke(coinQuery, 'getCoins').then(function (coinList) {
    var txDb = self._wallet.getTxDb()
    var transactions = _.chain(coinList.getCoins())
      .pluck('txId')
      .uniq()
      .map(function (txId) {
        var tx = txDb.getTx(txId)
        if (tx === null) {
          throw new Error('txId ' + txId + ' not found in txDb')
        }

        return [tx.getId(), {
          tx: tx,
          height: txDb.getTxHeight(txId),
          timestamp: txDb.getTxTimestamp(txId)
        }]
      })
      .sortBy(function (entry) {
        if (entry[1].height === 0) { return entry[1].timestamp }
        return entry[1].height + entry[1].timestamp/10000000000
      })
      .value()

    var txEntries = _.zipObject(transactions)
    transactions = transactions.map(function (entry) { return entry[1].tx })

    var promise = Q()
    var coins = _.chain(coinList.getCoins())
      .map(function (coin) { return [coin.txId+coin.outIndex, coin] })
      .zipObject()
      .value()

    toposort(transactions).forEach(function(tx) {
      var colorValues = {}
      var myColorTargets = []

      var ins = _.filter(tx.ins.map(function (input) {
        var txId = Array.prototype.reverse.call(new Buffer(input.hash)).toString('hex')
        return coins[txId+input.index]
      }))
      ins.forEach(function (coin) {
        promise = promise.then(function () {
          return Q.ninvoke(coin, 'getMainColorValue')

        }).then(function (cv) {
          var cid = cv.getColorId()
          if (_.isUndefined(colorValues[cid])) {
            colorValues[cid] = cv.neg()

          } else {
            colorValues[cid] = colorValues[cid].minus(cv)

          }

        })
      })

      var outs = _.filter(tx.outs.map(function (output, index) {
        return coins[tx.getId()+index]
      }))
      outs.forEach(function(coin) {
        promise = promise.then(function() {
          return Q.ninvoke(coin, 'getMainColorValue')

        }).then(function (cv) {
          var cid = cv.getColorId()
          if (_.isUndefined(colorValues[cid])) {
            colorValues[cid] = cv

          } else {
            colorValues[cid] = colorValues[cid].plus(cv)

          }

          myColorTargets.push(new cclib.ColorTarget(coin.script, cv))
        })
      })

      var colorTargets = []
      tx.outs.forEach(function (output, index) {
        promise = promise.then(function () {
          if (!_.isUndefined(coins[tx.getId()+index])) { return }

          var address = bitcoin.getAddressesFromOutputScript(output.script, self._wallet.getBitcoinNetwork())[0]
          var coin = new Coin(self._wallet.getCoinManager(), {
            txId: tx.getId(),
            outIndex: index,
            value: output.value,
            script: output.script.toHex(),
            address: address
          })

          return Q.ninvoke(coin, 'getMainColorValue').then(function (cv) {
            colorTargets.push(new cclib.ColorTarget(output.script.toHex(), cv))
          })
        })
      })

      promise = promise.then(function () {
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

        var historyTargets = colorTargets.map(function (ct) {
          var desc = ct.getColorDefinition().getDesc()
          var assetdef = self._wallet.getAssetDefinitionManager().getByDesc(desc)
          if (assetdef === null) {
            throw new Error('asset for ColorValue ' + ct.getColorValue() + ' not found')
          }

          var assetValue = new AssetValue(assetdef, ct.getValue())
          return new HistoryTarget(assetValue, ct.getScript(), self._wallet.getBitcoinNetwork())
        })

        var entryType = historyEntryType.send
        if (ins.length === 0) {
          entryType = historyEntryType.receive
          // replace targets
          historyTargets = myColorTargets.map(function (ct) {
            var desc = ct.getColorDefinition().getDesc()
            var assetdef = self._wallet.getAssetDefinitionManager().getByDesc(desc)
            if (assetdef === null) {
              throw new Error('asset for ColorValue ' + ct.getColorValue() + ' not found')
            }

            var assetValue = new AssetValue(assetdef, ct.getValue())
            return new HistoryTarget(assetValue, ct.getScript(), self._wallet.getBitcoinNetwork())
          })
        }
        if (ins.length === tx.ins.length && outs.length === tx.outs.length) {
          entryType = historyEntryType.payment2yourself
        }

        self._entries.push(new HistoryEntry({
          tx: tx,
          height: txEntries[tx.getId()].height,
          timestamp: txEntries[tx.getId()].timestamp,
          values: _.values(assetValues),
          targets: historyTargets,
          entryType: entryType
        }))
      })
    })

    return promise

  }).then(function () {
    self._needUpdating = self._needUpdating - currentNeedUpdating
    if (self._needUpdating > 0) {
      return self._updateEntries()
    }

    self._updatePromise = null

  })
}

/**
 * @callback HistoryManager~getEntries
 * @param {?Error} error
 * @param {HistoryEntry[]} entries
 */

/**
 * @param {AssetDefinition} [assetdef]
 * @param {HistoryManager~getEntries} cb
 */
HistoryManager.prototype.getEntries = function(assetdef, cb) {
  if (_.isUndefined(cb)) {
    cb = assetdef
    assetdef = null
  }

  if (assetdef !== null) verify.AssetDefinition(assetdef)
  verify.function(cb)

  var self = this
  var promise = Q()
  if (self._needUpdating > 0) {
    if (self._updatePromise === null) { self._updatePromise = self._updateEntries() }
    promise = self._updatePromise
  }

  promise.then(function () {
    if (assetdef === null)
      return self._entries

    var assetId = assetdef.getId()
    return self._entries.filter(function (entry) {
      var assetIds = entry.getTargets().map(function (at) { return at.getAsset().getId() })
      return assetIds.indexOf(assetId) !== -1
    })

  }).then(function (entries) {
    // clone
    return entries.slice()

  }).done(function(entries) { cb(null, entries) }, function(error) { cb(error) })
}


module.exports = HistoryManager
