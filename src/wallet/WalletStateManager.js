var events = require('events')
var inherits = require('util').inherits

var _ = require('lodash')
var Q = require('q')

var WalletState = require('./WalletState')
var util = require('../util')
var verify = require('../verify')
var txStatus = require('../const').txStatus


/**
 * @event WalletStateManager#error
 * @param {Error} error
 */

/**
 * @event WalletStateManager#syncStart
 */

/**
 * @event WalletStateManager#syncStop
 */

/**
 * @event WalletStateManager#addTx
 * @param {Transaction} tx
 */

/**
 * @event WalletStateManager#updateTx
 * @param {Transaction} tx
 */

/**
 * @event WalletStateManager#revertTx
 * @param {Transaction} tx
 */

/**
 * @event WalletStateManager#touchAddress
 * @param {string} address
 */

/**
 * @event WalletStateManager#touchAsset
 * @param {AssetDefinition} assetdef
 */

/**
 * @event WalletStateManager#historyUpdate
 */

/**
 * @class WalletStateManager
 * @extends events.EventEmitter
 * @mixes SyncMixin
 * @param {Wallet} wallet
 */
function WalletStateManager(wallet) {
  verify.Wallet(wallet)

  var self = this
  events.EventEmitter.call(self)
  util.SyncMixin.call(self)

  self._wallet = wallet
  self._distpatchedTxIds = {}

  self._currentState = new WalletState(self._wallet)

  self._executeQueue = []

  self._currentState.getTxManager().getAllTxIds().filter(function (txId) {
    if (self._currentState.getTxManager().getTxData(txId).status === txStatus.dispatch) {
      self._attemptSendTx(txId)
    }
  })
  self.on('sendTx', function (tx) {
    self._attemptSendTx(tx.getId())
  })
}

inherits(WalletStateManager, events.EventEmitter)

/**
 * @param {string} txId
 * @param {number} [attempt=0]
 */
WalletStateManager.prototype._attemptSendTx = function (txId, attempt) {
  var self = this

  if (_.isUndefined(attempt)) {
    if (!_.isUndefined(self._distpatchedTxIds[txId])) {
      return
    }

    self._distpatchedTxIds[txId] = true
    attempt = 0
  }

  verify.txId(txId)
  verify.number(attempt)

  var tx = self._currentState.getTxManager().getTx(txId)
  if (tx === null) {
    return
  }

  /**
   * @param {number} status
   */
  function updateTx(status) {
    delete self._distpatchedTxIds[txId]

    self.execute(function (walletState) {
      var promise = Q()
      promise = promise.then(function () {
        return walletState.getTxManager().updateTx(tx, {status: status})
      })

      if (status === txStatus.invalid) {
        promise = promise.then(function () { return walletState.getCoinManager().revertTx(tx) })
        promise = promise.then(function () { return walletState.getHistoryManager().revertTx(tx) })

      } else {
        promise = promise.then(function () { return walletState.getCoinManager().updateTx(tx) })
        promise = promise.then(function () { return walletState.getHistoryManager().updateTx(tx) })

      }

      return promise.then(function () { return {commit: true} })
    })
  }

  Q.ninvoke(self._wallet.getBlockchain(), 'sendTx', tx).done(function () {
    updateTx(txStatus.pending)

  }, function (error) {
    self.emit('error', error)

    if (attempt >= 5) {
      return updateTx(txStatus.invalid)
    }

    var timeout = 15000 * Math.pow(2, attempt)
    Q.delay(timeout).then(function () { self._attemptSendTx(txId, attempt + 1) })
  })
}

/**
 * @callback WalletStateManager~execute
 * @param {WalletState} walletState
 * @return {Q.Promise<{commit: boolean}>}
 */

/**
 * @param {WalletStateManager~execute} fn
 * @return {Q.Promise}
 */
WalletStateManager.prototype.execute = function (fn) {
  verify.function(fn)

  var self = this
  self._executeQueue.push(Q.defer())
  if (self._executeQueue.length === 1) {
    self._executeQueue[0].resolve()
    self._syncEnter()
  }

  return _.last(self._executeQueue).promise.then(function () {
    var walletState = new WalletState(self._wallet)

    var events = new util.OrderedMap()
    walletState.getTxManager().on('addTx', function (tx) {
      events.add('addTx' + tx.getId(), ['addTx', tx])
    })
    walletState.getTxManager().on('updateTx', function (tx) {
      events.add('updateTx' + tx.getId(), ['updateTx', tx])
    })
    walletState.getTxManager().on('revertTx', function (tx) {
      events.add('revertTx' + tx.getId(), ['revertTx', tx])
    })
    walletState.getTxManager().on('sendTx', function (tx) {
      events.add('sendTx' + tx.getId(), ['sendTx', tx])
    })
    walletState.getCoinManager().on('touchAddress', function (address) {
      events.add('touchAddress' + address, ['touchAddress', address])
    })
    walletState.getCoinManager().on('touchAsset', function (assetdef) {
      events.add('touchAsset' + assetdef.getId(), ['touchAsset', assetdef])
    })
    walletState.getHistoryManager().on('update', function () {
      events.add('update', ['historyUpdate'])
    })

    return fn(walletState).finally(function () {
      walletState.getTxManager().removeAllListeners()
      walletState.getCoinManager().removeAllListeners()
      walletState.getHistoryManager().removeAllListeners()

    }).catch(function (error) {
      self.emit('error', error)

    }).then(function (result) {
      if (!_.isObject(result) || result.commit !== true) {
        return
      }

      walletState.save()
      self._currentState = walletState

      events.getVals().forEach(function (args) {
        self.emit.apply(self, args)
      })
    })

  }).finally(function () {
    self._executeQueue.shift()
    if (self._executeQueue.length > 0) {
      return self._executeQueue[0].resolve()
    }

    self._syncExit()
  })
}

/**
 * @param {string} address
 * @param {{txId: string, height: number}[]} entries
 * @return {Q.Promise}
 */
WalletStateManager.prototype.historySync = function (address, entries) {
  var self = this

  entries = _.chain(entries)
    .uniq('txId')
    .sortBy(function (entry) { return entry.height === 0 ? Infinity : entry.height })
    .value()

  var TxIdsForRemove = _.difference(self._currentState.getTxManager().getAllTxIds(address), _.pluck(entries, 'txId'))
  var promises = TxIdsForRemove.map(function (txId) {
    return self.execute(function (walletState) {
      var tx = walletState.getTxManager().getTx(txId)
      if (tx === null) {
        return Q({commit: false})
      }

      var promise = Q()
      promise = promise.then(function () { return walletState.getTxManager().revertTx(tx, address) })
      promise = promise.then(function () { return walletState.getCoinManager().revertTx(tx) })
      promise = promise.then(function () { return walletState.getHistoryManager().revertTx(tx) })
      return promise.then(function () { return {commit: true} })
    })
  })

  promises = promises.concat(entries.map(function (entry) {
    return self.execute(function (walletState) {
      var status = entry.height === 0 ? txStatus.unconfirmed : txStatus.confirmed

      var tx = walletState.getTxManager().getTx(entry.txId)
      if (tx !== null) {
        var txHeight = walletState.getTxManager().getTxData(entry.txId).height
        var isTouchedAddress = walletState.getTxManager().isTouchedAddress(entry.txId, address)
        if (txHeight === entry.height && isTouchedAddress) {
          return Q({commit: false})
        }

        var promise = Q()
        promise = promise.then(function () {
          return walletState.getTxManager().updateTx(tx, {status: status, height: entry.height, tAddress: address})
        })
        promise = promise.then(function () { return walletState.getCoinManager().updateTx(tx) })
        promise = promise.then(function () { return walletState.getHistoryManager().updateTx(tx) })
        return promise.then(function () { return {commit: true} })
      }

      return Q.ninvoke(self._wallet.getBlockchain(), 'getTx', entry.txId).then(function (tx) {
        var promise = Q()
        promise = promise.then(function () {
          return walletState.getTxManager().addTx(tx, {status: status, height: entry.height, tAddresses: address})
        })
        promise = promise.then(function () { return walletState.getCoinManager().addTx(tx) })
        promise = promise.then(function () { return walletState.getHistoryManager().addTx(tx) })
        return promise.then(function () { return {commit: true} })
      })
    })
  }))

  return Q.all(promises)
}

/**
 * @param {Transaction} tx
 * @return {Q.Promise}
 */
WalletStateManager.prototype.sendTx = function (tx) {
  return this.execute(function (walletState) {
    var promise = Q()
    promise = promise.then(function () { return walletState.getTxManager().sendTx(tx) })
    promise = promise.then(function () { return walletState.getCoinManager().addTx(tx) })
    promise = promise.then(function () { return walletState.getHistoryManager().addTx(tx) })
    return promise.then(function () { return {commit: true} })
  })
}

/**
 * @param {string} txId
 * @return {?Transaction}
 */
WalletStateManager.prototype.getTx = function (txId) {
  return this._currentState.getTxManager().getTx(txId)
}

/**
 * @param {(string|string[])} addresses
 * @return {Coin[]}
 */
WalletStateManager.prototype.getCoins = function (addresses) {
  return this._currentState.getCoinManager().getCoins(addresses)
}

/**
 * @param {AssetDefinition} [assetdef]
 * @return {HistoryEntry[]}
 */
WalletStateManager.prototype.getHistory = function (assetdef) {
  return this._currentState.getHistoryManager().getEntries(assetdef)
}

/**
 */
WalletStateManager.prototype.clear = function () {
  var self = this
  self.once('syncStop', function () {
    self._currentState.clear()
    self._currentState = new WalletState(self._wallet)
  })
}


module.exports = WalletStateManager
