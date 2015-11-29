var events = require('events')
var inherits = require('util').inherits
var SyncMixin = require('sync-mixin')
var _ = require('lodash')
var Q = require('q')
var bitcore = require('bitcore-lib')
var cclib = require('coloredcoinjs-lib')

var WalletState = require('./WalletState')
var errors = require('../errors')
var TX_STATUS = require('../util/const').TX_STATUS
var OrderedMap = require('../util/ordered-map')

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
 * @event WalletStateManager#newColor
 * @param {string} desc
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
 * @param {WalletStateStorage} stateStorage
 */
function WalletStateManager (wallet, stateStorage) {
  var self = this
  events.EventEmitter.call(self)

  self._wallet = wallet
  self._stateStorage = stateStorage
  self._currentState = new WalletState(self._wallet, self._stateStorage)
  self._executeQueue = []

  // disable tx sending with attempts... (temporary)
  // self._currentState.getTxManager().getAllTxIds().filter(function (txId) {
  //   var txStatus = self._currentState.getTxManager().getTxStatus(txId)
  //   if (TX_STATUS.isDispatch(txStatus)) {
  //     self._attemptSendTx(txId)
  //   }
  // })

  // self.on('sendTx', function (tx) {
  //   self._attemptSendTx(tx.getId())
  // })
}

inherits(WalletStateManager, events.EventEmitter)
_.assign(WalletStateManager.prototype, SyncMixin)

/**
 * @private
 * @param {string} txId
 * @param {number} [attempt=0]
 */
WalletStateManager.prototype._attemptSendTx = function (txId, attempt) {
  var self = this

  if (_.isUndefined(attempt)) {
    attempt = 0
  }

  var tx = self._currentState.getTxManager().getTx(txId)
  if (tx === null) {
    return
  }

  /**
   * Update tx status and
   *     update coins & history if tx have not invalid status
   *     delete coins & history if tx status is invalid
   *
   * @param {number} status
   */
  function updateTx (status) {
    self.execute(function (walletState) {
      var methodName = TX_STATUS.isInvalid(status) ? 'revertTx' : 'updateTx'

      return Q.fcall(function () {
        return walletState.getTxManager().updateTx(tx, {status: status})
      })
      .then(function () {
        var coinManager = walletState.getCoinManager()
        return coinManager[methodName](tx)
      })
      .then(function () {
        var historyManager = walletState.getHistoryManager()
        return historyManager[methodName](tx)
      })
      .then(function () {
        return {commit: true}
      })
    })
  }

  self._wallet.getBlockchain().sendTx(tx.toHex())
    .then(function () {
      /** @todo Check propagation with blockchain? */
      updateTx(TX_STATUS.pending)
    }, function (error) {
      self.emit('error', error)

      if (attempt >= 5) {
        return updateTx(TX_STATUS.invalid)
      }

      var timeout = 15000 * Math.pow(2, attempt)
      Q.delay(timeout).then(function () {
        self._attemptSendTx(txId, attempt + 1)
      })
    })
}

/**
 * Return current WalletState if given undefined
 *
 * @private
 * @param {WalletState} [walletState]
 * @return {WalletState}
 */
WalletStateManager.prototype._resolveWalletState = function (walletState) {
  if (_.isUndefined(walletState)) {
    return this._currentState
  }

  return walletState
}

/**
 * Create getTxFn with given WalletState
 *     or use current WalletState if given undefined
 *
 * @private
 * @param {WalletState} [walletState]
 * @return {Blockchain~getTx}
 */
WalletStateManager.prototype._createGetTxFn = function (walletState) {
  walletState = this._resolveWalletState(walletState)

  var blockchain = this._wallet.getBlockchain()
  return function (txId) {
    var tx = walletState.getTxManager().getTx(txId)
    if (tx !== null) {
      return Q.resolve(tx)
    }

    return blockchain.getTx(txId)
  }
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
  var self = this
  self._executeQueue.push(Q.defer())
  if (self._executeQueue.length === 1) {
    self._executeQueue[0].resolve()
    self._syncEnter()
  }

  return _.last(self._executeQueue).promise.then(function () {
    var walletState = new WalletState(self._wallet, self._stateStorage)

    var events = new OrderedMap()
    walletState.getTxStateSet().on('error', function (err) {
      events.add('error' + Date.now(), ['error', err])
    })
    walletState.getTxManager().on('addTx', function (tx) {
      events.add('addTx' + tx.id, ['addTx', tx])
    })
    walletState.getTxManager().on('updateTx', function (tx) {
      events.add('updateTx' + tx.id, ['updateTx', tx])
    })
    walletState.getTxManager().on('revertTx', function (tx) {
      events.add('revertTx' + tx.id, ['revertTx', tx])
    })
    walletState.getTxManager().on('sendTx', function (tx) {
      events.add('sendTx' + tx.id, ['sendTx', tx])
    })
    walletState.getCoinManager().on('touchAddress', function (address) {
      events.add('touchAddress' + address, ['touchAddress', address])
    })
    walletState.getCoinManager().on('newColor', function (colorDesc) {
      events.add('newColor' + colorDesc, ['newColor', colorDesc])
    })
    walletState.getCoinManager().on('touchAsset', function (assetdef) {
      events.add('touchAsset' + assetdef.id, ['touchAsset', assetdef])
    })
    walletState.getHistoryManager().on('update', function () {
      events.add('update', ['historyUpdate'])
    })

    return Q.try(function () {
      return fn(walletState)
    })
    .finally(function () {
      walletState.getTxManager().removeAllListeners()
      walletState.getCoinManager().removeAllListeners()
      walletState.getHistoryManager().removeAllListeners()
    })
    .catch(function (err) {
      self.emit('error', err)
      throw err
    })
    .then(function (result) {
      if (!_.isObject(result) || result.commit !== true) {
        return
      }

      walletState.save({saveNow: result.saveNow || false})
      self._currentState = walletState

      events.getValues().forEach(function (args) {
        self.emit.apply(self, args)
      })
    })
  })
  .finally(function () {
    self._executeQueue.shift()
    if (self._executeQueue.length > 0) {
      return self._executeQueue[0].resolve()
    }

    self._syncExit()
  })
}

/**
 * Adds tx to local storage and trying to send to network through remote service
 *
 * @param {Transaction} tx
 * @return {Q.Promise}
 */
WalletStateManager.prototype.sendTx = function (tx) {
  // return this.execute(function (walletState) {
  //   var promise = Q()
  //   promise = promise.then(function () { return walletState.getTxManager().sendTx(tx) })
  //   promise = promise.then(function () { return walletState.getCoinManager().addTx(tx) })
  //   promise = promise.then(function () { return walletState.getHistoryManager().addTx(tx) })
  //   return promise.then(function () { return {commit: true, saveNow: true} })
  // })

  var self = this
  return self._wallet.getBlockchain().sendTx(tx.toString())
    .then(function () {
      return self.execute(function (walletState) {
        return Q.resolve()
          .then(function () { return walletState.getTxManager().sendTx(tx) })
          .then(function () { return walletState.getTxManager().updateTx(tx, {status: TX_STATUS.pending}) })
          .then(function () { return walletState.getCoinManager().addTx(tx) })
          .then(function () { return walletState.getCoinManager().updateTx(tx) })
          .then(function () { return walletState.getHistoryManager().addTx(tx) })
          .then(function () { return walletState.getHistoryManager().updateTx(tx) })
          .then(function () { return {commit: true, saveNow: true} })
      })
    })
}

/**
 * @return {Q.Promise}
 */
WalletStateManager.prototype.sync = function (addresses) {
  console.log('WSM.sync!')
  var self = this

  return self.execute(function (walletState) {
    console.log('WSM.sync.execute')
    var blockchain = self._wallet.getBlockchain()

    var txManager = walletState.getTxManager()
    return walletState.getTxStateSet().autoSync(
      blockchain, addresses, txManager.getAllTxIds())
        .then(function (newTxSS) {
          var changes = newTxSS.getChanges()
          console.log('applying ' + changes.length + ' changes')
          if (changes.length === 0) {
            return {commit: false}
          }

          var coinManager = walletState.getCoinManager()
          var historyManager = walletState.getHistoryManager()
          return Q.all(changes.map(function (txr) {
            return txManager.processTxRecord(txr, coinManager, historyManager)
          }))
          .then(function () {
            historyManager.emit('update')
            console.log('commiting changes')
            walletState.setTxStateSet(newTxSS)
            return {commit: true}
          })
        })
  })
}

/**
 * @callback WalletStateManager~freezeUnfreezeCallback
 * @param {?Error} error
 */

/**
 * @param {Array.<{txId: string, outIndex: number}>} coins
 * @param {Object} opts Freeze options
 * @param {number} [opts.height] Freeze until height is not be reached
 * @param {number} [opts.timestamp] Freeze until timestamp is not be reached
 * @param {number} [opts.fromNow] As timestamp that equal (Date.now() + fromNow)
 * @param {WalletStateManager~freezeUnfreezeCallback} cb
 */
WalletStateManager.prototype.freezeCoins = function (coins, opts, cb) {
  this.execute(function (walletState) {
    walletState.getCoinManager().freezeCoins(coins, opts)
    return Q.resolve({commit: true})
  })
  .then(function () { cb(null) },
        function (error) { cb(error) })
}

/**
 * @param {Array.<{txId: string, outIndex: number}>} coins
 * @param {WalletStateManager~freezeUnfreezeCallback} cb
 */
WalletStateManager.prototype.unfreezeCoins = function (coins, cb) {
  this.execute(function (walletState) {
    walletState.getCoinManager().unfreezeCoins(coins)
    return Q.resolve({commit: true})
  })
  .then(function () { cb(null) },
        function (error) { cb(error) })
}

/**
 * @param {string} txId
 * @param {WalletState} [walletState]
 * @return {?Transaction}
 */
WalletStateManager.prototype.getTx = function (txId, walletState) {
  walletState = this._resolveWalletState(walletState)
  return walletState.getTxManager().getTx(txId)
}

/**
 * @callback WalletStateManager~getTxMainColorValuesCallback
 * @param {?Error} error
 * @param {cclib.ColorValue[]} colorValues
 */

/**
 * Get ColorValues for given tx
 *
 * @param {bitcore.Transaction} tx Tx for processing
 * @param {WalletState} [walletState] Custom WalletState
 * @param {WalletStateManager~getTxMainColorValuesCallback} cb
 */
WalletStateManager.prototype.getTxMainColorValues = function (tx, walletState, cb) {
  // tx, function, undefined -> tx, undefined, function
  if (_.isFunction(walletState) && _.isUndefined(cb)) {
    cb = walletState
    walletState = undefined
  }

  walletState = this._resolveWalletState(walletState)
  var getTxFn = this._createGetTxFn(walletState)

  return this._wallet.getColorData().getOutColorValues(tx, null, cclib.definitions.EPOBC, getTxFn)
    .then(function (colorValues) {
      var values = new Array(tx.outputs.length)

      for (var iter = colorValues.values(), data = iter.next(); !data.done; data = iter.next()) {
        for (var outputIndex = 0; outputIndex < values.length; ++outputIndex) {
          if (data.value[outputIndex] !== null) {
            if (values[outputIndex] !== undefined) {
              var msg = tx.id + ':' + outputIndex + ' have more than one ColorValue'
              throw new errors.CoinColorValueError(msg)
            }

            values[outputIndex] = data.value[outputIndex]
          }
        }
      }

      for (var index = 0; index < values.length; ++index) {
        if (values[index] === undefined) {
          var uncolored = cclib.definitions.Manager.getUncolored()
          values[index] = new cclib.ColorValue(uncolored, tx.outputs[index].satoshis)
        }
      }

      return values
    })
    .then(function (colorValues) { cb(null, colorValues) },
          function (error) { cb(error) })
}

/**
 * @param {(string|string[])} addresses
 * @param {WalletState} [walletState]
 * @return {Coin[]}
 */
WalletStateManager.prototype.getCoins = function (addresses, walletState) {
  walletState = this._resolveWalletState(walletState)
  return walletState.getCoinManager().getCoins(addresses)
}

/**
 * @param {{txId: string, outIndex: number}} coin
 * @param {WalletState} [walletState]
 * @return {boolean}
 */
WalletStateManager.prototype.isCoinSpent = function (coin, walletState) {
  walletState = this._resolveWalletState(walletState)
  return walletState.getCoinManager().isCoinSpent(coin)
}

/**
 * @param {{txId: string}} coin
 * @param {WalletState} [walletState]
 * @return {boolean}
 * @throws {TxNotFoundError} If tx for given coin not found
 */
WalletStateManager.prototype.isCoinValid = function (coin, walletState) {
  walletState = this._resolveWalletState(walletState)
  return walletState.getCoinManager().isCoinValid(coin)
}

/**
 * @param {{txId: string}} coin
 * @param {WalletState} [walletState]
 * @return {boolean}
 * @throws {TxNotFoundError} If tx for given coin not found
 */
WalletStateManager.prototype.isCoinAvailable = function (coin, walletState) {
  walletState = this._resolveWalletState(walletState)
  return walletState.getCoinManager().isCoinAvailable(coin)
}

/**
 * @param {{txId: string, outIndex: number}} coin
 * @param {WalletState} [walletState]
 * @return {boolean}
 * @throws {CoinNotFoundError} If coin for given txId:outIndex not found
 */
WalletStateManager.prototype.isCoinFrozen = function (coin, walletState) {
  walletState = this._resolveWalletState(walletState)
  return walletState.getCoinManager().isCoinFrozen(coin)
}

/**
 * @callback WalletStateManager~getCoinMainColorValueCallback
 * @param {?Error} error
 * @param {ColorValue} colorValue
 */

/**
 * Get main ColorValue for given txId:outIndex
 *
 * @param {{txId: string, outIndex: number, value: number}} coin
 * @param {WalletState} [walletState]
 * @param {WalletStateManager~getCoinMainColorValueCallback} cb
 */
WalletStateManager.prototype.getCoinMainColorValue = function (coin, walletState, cb) {
  // coin, function, undefined -> coin, undefined, function
  if (_.isFunction(walletState) && _.isUndefined(cb)) {
    cb = walletState
    walletState = undefined
  }

  walletState = this._resolveWalletState(walletState)
  var getTxFn = this._createGetTxFn(walletState)
  var wallet = this._wallet

  Q.fcall(function () {
    if (coin.txId !== undefined) {
      return Q.all([getTxFn(coin.txId, {save: true})])
    }

    coin.txId = coin.tx.id
    return Q.all([coin.tx, {save: false}])
  })
  .spread(function (rawTx, opts) {
    var tx = new bitcore.Transaction(rawTx)
    return Q.all([
      Q.resolve(tx),
      wallet.getColorData().getOutColorValues(tx, [coin.outIndex], cclib.definitions.EPOBC, getTxFn, opts)
    ])
  })
  .then(function (result) {
    var tx = result[0]
    var colorValues = result[1]

    var value = null
    for (var iter = colorValues.values(), data = iter.next(); !data.done; data = iter.next()) {
      if (data.value[coin.outIndex] !== null) {
        if (value !== null) {
          var msg = coin.txId + ':' + coin.outIndex + ' have more than one ColorValue'
          throw new errors.CoinColorValueError(msg)
        }

        value = data.value[coin.outIndex]
      }
    }

    if (value === null) {
      var uncolored = cclib.definitions.Manager.getUncolored()
      value = new cclib.ColorValue(uncolored, tx.outputs[coin.outIndex].satoshis)
    }

    return value
  })
  .then(function (colorValue) { cb(null, colorValue) },
        function (error) { cb(error) })
}

/**
 * @param {AssetDefinition} [assetdef]
 * @param {WalletState} [walletState]
 * @return {HistoryEntry[]}
 */
WalletStateManager.prototype.getHistory = function (assetdef, walletState) {
  walletState = this._resolveWalletState(walletState)
  return walletState.getHistoryManager().getEntries(assetdef)
}

/**
 */
WalletStateManager.prototype.clear = function () {
  var self = this
  self.once('syncStop', function () {
    self._currentState.clear()
    self._currentState = new WalletState(self._wallet, self._stateStorage)
  })
}

module.exports = WalletStateManager
