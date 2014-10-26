var _ = require('lodash')
var Q = require('q')

var cclib = require('../cclib')
var bitcoin = cclib.bitcoin
var AssetValue = require('../asset').AssetValue
var AssetTarget = require('../asset').AssetTarget
var Coin = require('../coin').Coin
var toposort = require('../tx').toposort
var HistoryEntry = require('./HistoryEntry')
var verify = require('../verify')


/**
 * @class HistoryManager
 *
 * @param {Wallet} wallet
 */
function HistoryManager(wallet) {
  verify.Wallet(wallet)

  this.wallet = wallet
}

/**
 * @callback HistoryManager~getEntries
 * @param {?Error} error
 * @param {HistoryEntry[]} entries
 */

/**
 * @param {HistoryManager~getEntries} cb
 */
HistoryManager.prototype.getEntries = function(cb) {
  verify.function(cb)

  var self = this

  Q.fcall(function() {
    return Q.ninvoke(self.wallet.getCoinQuery().includeSpent().includeUnconfirmed(), 'getCoins')

  }).then(function(coinList) {
    var txDb = self.wallet.getTxDb()
    var transactions = _.chain(coinList.getCoins())
      .pluck('txId')
      .uniq()
      .map(function(txId) {
        var entry = {
          tx: txDb.getTxById(txId),
          blockHeight: txDb.getBlockHeightByTxId(txId),
          timestamp: txDb.getTimestampByTxId(txId)
        }
        if (entry.tx === null)
          throw new Error('txId ' + txId + ' not found in txDb')

        return [entry.tx.getId(), entry]
      })
      .sortBy(function(entry) {
        var value = entry[1].blockHeight + entry[1].timestamp/10000000000
        return isNaN(value) ? -1 : value
      })
      .value()

    var txEntries = _.zipObject(transactions)
    transactions = transactions.map(function(entry) { return entry[1].tx })

    var promise = Q()
    var entries = []
    var coins = _.zipObject(coinList.getCoins().map(function(coin) { return [coin.txId+coin.outIndex, coin] }))

    toposort(transactions).forEach(function(tx) {
      var ins = _.filter(tx.ins.map(function(input) {
        var txId = Array.prototype.reverse.call(new Buffer(input.hash)).toString('hex')
        return coins[txId+input.index]
      }))
      var outs = _.filter(tx.outs.map(function(output, index) {
        return coins[tx.getId()+index]
      }))

      var colorValues = {}
      var myColorTargets = []
      ins.forEach(function(coin) {
        promise = promise.then(function() { return Q.ninvoke(coin, 'getMainColorValue') }).then(function(cv) {
          var cid = cv.getColorId()
          if (_.isUndefined(colorValues[cid]))
            colorValues[cid] = cv.neg()
          else
            colorValues[cid] = colorValues[cid].minus(cv)
        })
      })
      outs.forEach(function(coin) {
        promise = promise.then(function() { return Q.ninvoke(coin, 'getMainColorValue') }).then(function(cv) {
          var cid = cv.getColorId()
          if (_.isUndefined(colorValues[cid]))
            colorValues[cid] = cv
          else
            colorValues[cid] = colorValues[cid].plus(cv)
          myColorTargets.push(new cclib.ColorTarget(coin.toRawCoin().script, cv))
        })
      })

      var colorTargets = []
      tx.outs.forEach(function(output, index) {
        promise = promise.then(function() {
          if (!_.isUndefined(coins[tx.getId()+index]))
            return

          var address = bitcoin.Address.fromOutputScript(output.script, self.wallet.getBitcoinNetwork()).toBase58Check()
          var coin = new Coin(self.wallet.getCoinManager(), {
            txId: tx.getId(),
            outIndex: index,
            value: output.value,
            script: output.script.toHex(),
            address: address
          })

          return Q.ninvoke(coin, 'getMainColorValue').then(function(cv) {
            colorTargets.push(new cclib.ColorTarget(output.script.toHex(), cv))
          })
        })
      })

      promise = promise.then(function() {
        var assetValues = {}
        _.values(colorValues).forEach(function(cv) {
          var desc = cv.getColorDefinition().getDesc()
          var assetdef = self.wallet.getAssetDefinitionManager().getByDesc(desc)
          if (assetdef === null)
            throw new Error('asset for ColorValue ' + cv + ' not found')
          if (!_.isUndefined(assetValues[assetdef.getId()]))
            throw new Error('multi asset not supported')
          assetValues[assetdef.getId()] = new AssetValue(assetdef, cv.getValue())
        })

        var assetTargets = colorTargets.map(function(ct) {
          var desc = ct.getColorDefinition().getDesc()
          var assetdef = self.wallet.getAssetDefinitionManager().getByDesc(desc)
          if (assetdef === null)
            throw new Error('asset for ColorValue ' + ct.getColorValue() + ' not found')
          var assetValue = new AssetValue(assetdef, ct.getValue())
          return new AssetTarget(ct.getScript(), assetValue)
        })

        var entryType = HistoryEntry.entryTypes.Send
        if (ins.length === 0) {
          entryType = HistoryEntry.entryTypes.Receive
          // replace targets
          assetTargets = myColorTargets.map(function(ct) {
            var desc = ct.getColorDefinition().getDesc()
            var assetdef = self.wallet.getAssetDefinitionManager().getByDesc(desc)
            if (assetdef === null)
              throw new Error('asset for ColorValue ' + ct.getColorValue() + ' not found')
            var assetValue = new AssetValue(assetdef, ct.getValue())
            return new AssetTarget(ct.getScript(), assetValue)
          })
        }
        if (ins.length === tx.ins.length && outs.length === tx.outs.length)
          entryType = HistoryEntry.entryTypes.PaymentToYourself

        entries.push(new HistoryEntry({
          tx: tx,
          blockHeight: txEntries[tx.getId()].blockHeight,
          timestamp: txEntries[tx.getId()].timestamp,
          values: _.values(assetValues),
          targets: assetTargets,
          entryType: entryType
        }))
      })
    })

    return promise.then(function() { return entries })

  }).done(function(entries) { cb(null, entries) }, function(error) { cb(error) })
}


module.exports = HistoryManager
