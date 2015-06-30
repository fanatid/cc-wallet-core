'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var events = require('events')
var bitcore = require('bitcore')
var Promise = require('bluebird')
var makeConcurrent = require('make-concurrent')(Promise)
var ReadyMixin = require('ready-mixin')(Promise)
var blockchainjs = require('blockchainjs')

var SyncMixin = require('../util/sync-mixin')
var TX_STATUS = require('../util/const').TX_STATUS

/**
 * @name TxManager~getCurrentTimestamp
 * @return {number}
 */
function getCurrentTimestamp () {
  return Math.round(Date.now() / 1000)
}

/**
 * @event TxManager#error
 * @param {Error} err
 */

/**
 * @event TxManager#add
 * @param {string} txid
 */

/**
 * @event TxManager#update
 * @param {string} txid
 */

/**
 * @event TxManager#remove
 * @param {string} txid
 */

/**
 * @class TxManager
 * @param {ITxStorage} storage
 * @param {Wallet} wallet
 */
function TxManager (storage, wallet) {
  var self = this
  events.EventEmitter.call(self)

  self._wallet = wallet
  self._storage = storage

  self._withLock = makeConcurrent(function (fn) { return fn() })

  self._txRecords = []
  self._indexedTxRecords = {}

  self._lastHeight = null

  self._attemptSendTxLimit = Infinity
  self._attemptSendTxBaseTimeout = 3500
  self._attemptSendTxPowBase = 4
  self._attemptSendTxMax = 4

  // sync runners
  var syncQueue = []
  var notifyNeedSync = _.debounce(function () {
    if (!self._wallet.connector.isConnected() || syncQueue.length === 2) {
      return
    }

    var promise = Promise.resolve()
    if (syncQueue.length === 1) {
      promise = new Promise(function (resolve) {
        syncQueue[0].finally(resolve)
      })
    }

    promise = promise
      .then(function () {
        return self.sync()
      })
      .finally(function () {
        syncQueue.shift()
      })
      .catch(function (err) {
        self.emit('error', err)
      })

    syncQueue.push(promise)
  }, 100)

  self._wallet.connector.on('connect', notifyNeedSync)
  self._wallet.blockchain.on('touchAddress', notifyNeedSync)
  self.ready.then(notifyNeedSync)
  // setInterval(notifyNeedSync, 5000)

  function subscribeAllAddressesAndSync () {
    self._wallet.isInitialized()
      .then(function () {
        return self._wallet.getAllAddresses()
      })
      .then(function (addresses) {
        return Promise.map(addresses, function (address) {
          return self._wallet.blockchain.subscribeAddress(address)
        })
      })
      .then(notifyNeedSync)
      .done(_.noop, function (err) { self.emit('error', err) })
  }

  self._wallet.on('initialize', subscribeAllAddressesAndSync)
  self._wallet.on('newAddress', subscribeAllAddressesAndSync)
  subscribeAllAddressesAndSync()

  // start loader
  self._tryLoadTxs()
}

inherits(TxManager, events.EventEmitter)
ReadyMixin(TxManager.prototype)
SyncMixin(TxManager.prototype)

/**
 */
TxManager.prototype._tryLoadTxs = function () {
  var self = this
  Promise.try(function () {
    self._syncEnter()
    return self._storage.get()
      .then(function (records) {
        self._txRecords = records
        self._indexedTxRecords = _.indexBy(records, 'txid')

        return Promise.map(self._txRecords, function (record) {
          return Promise.all([
            self._wallet.coinManager.loadTx(record),
            self._wallet.historyManager.loadTx(record)
          ])
        })
      })
      .finally(function () {
        self._syncExit()
      })
      .then(function () {
        self._resortTxRecords()

        self._txRecords.forEach(function (record) {
          if (TX_STATUS.isDispatch(record.status)) {
            self._attemptSendTx(record.txid)
          }
        })
      })
  })
  .done(function () { self._ready() }, function (err) {
    setTimeout(self._tryLoadTxs.bind(self), 10 * 1000)
    self.emit('error', err)
  })
}

/**
 * @param {string} txid
 * @param {number} [attempt=0]
 */
TxManager.prototype._attemptSendTx = function (txid, attempt) {
  if (attempt === undefined) {
    attempt = 0
  }

  var self = this
  return self.ready
    .then(function () {
      var record = self._indexedTxRecords[txid]
      if (!TX_STATUS.isDispatch(record.status)) {
        return
      }

      /**
       * @param {number}
       * @return {Promise}
       */
      function updateTxStatus (status) {
        var eventName = TX_STATUS.isValid(record.status)
                          ? 'update'
                          : 'remove'

        return self._storage.update(txid, {status: status})
          .then(function () {
            record.status = status

            if (eventName === 'update') {
              return self._wallet.historyManager.updateTx(record)
            }

            return Promise.all([
              self._wallet.coinManager.removeTx(record),
              self._wallet.historyManager.removeTx(record)
            ])
          })
          .then(function () {
            self.emit(eventName, record.txid)
          })
      }

      self._syncEnter()
      return self._withLock(function () {
        return self._wallet.blockchain.sendTx(record.rawtx)
          .then(function () {
            return updateTxStatus(TX_STATUS.pending)

          }, function (err) {
            if (attempt >= self._attemptSendTxLimit) {
              return updateTxStatus(TX_STATUS.invalid)
            }

            var timeout = self._attemptSendTxBaseTimeout
            setTimeout(function () {
              self._attemptSendTx(
                txid, Math.min(attempt + 1, self._attemptSendTxMax))
            }, timeout * Math.pow(self._attemptSendTxPowBase, attempt))

            throw err
          })
      })
      .finally(function () {
        self._syncExit()
      })
    })
    .catch(function (err) {
      self.emit('error', err)
    })
}

/**
 */
TxManager.prototype._resortTxRecords = function () {
  this._txRecords = _.sortBy(this._txRecords, function (record) {
    return record.blockHeight === null ? -Infinity : -record.blockHeight
  })
}

/**
 * @return {Promise}
 */
TxManager.prototype._syncKnownTxs = function () {
  var self = this
  return Promise(function (resolve, reject) {
    var records = self._txRecords.slice()

    function maybeRefresh (idx) {
      if (idx >= records.length) {
        return resolve()
      }

      var record = records[idx]
      if (!(TX_STATUS.isConfirmed(record.status) ||
            TX_STATUS.isUnconfirmed(record.status))) {
        return maybeRefresh(idx + 1)
      }

      var promise = Promise.resolve(true) // unconfirmed, need refresh op.
      if (TX_STATUS.isConfirmed(record.status)) {
        promise = self._wallet.blockchain.getHeader(record.blockHeight)
          .then(function (header) {
            return header.hash !== record.blockHash
          })
      }

      promise
        .then(function (needRefresh) {
          if (!needRefresh) {
            return resolve()
          }

          return self._wallet.blockchain.getTxBlockHash(record.txid)
            .then(function (info) {
              switch (info.source) {
              case 'blocks':
                record.status = TX_STATUS.confirmed
                record.blockHeight = info.block.height
                record.blockHash = info.block.hash
                break
              case 'mempool':
                record.status = TX_STATUS.unconfirmed
                record.blockHeight = null
                record.blockHash = null
                break
              default:
                throw new Error('Unknow source: ' + info.source)
              }
            })
            .catch(blockchainjs.errors.Blockchain.TxNotFound, function () {
              record.status = TX_STATUS.invalid
            })
            .then(function () {
              var eventName = TX_STATUS.isValid(record.status)
                                ? 'update'
                                : 'remove'

              return self._storage.update(record.txid, record)
                .then(function () {
                  if (eventName === 'update') {
                    return self._wallet.historyManager.updateTx(record)
                  }

                  return Promise.all([
                    self._wallet.coinManager.removeTx(record),
                    self._wallet.historyManager.removeTx(record)
                  ])
                })
                .then(function () {
                  self.emit(eventName, record.txid)
                  maybeRefresh(idx + 1)
                })
            })
        })
        .catch(reject)
    }

    maybeRefresh(0)
  })
}

/**
 * @return {Promise}
 */
TxManager.prototype._syncUnknowTxs = function () {
  var self = this
  return self._wallet.getAllAddresses()
    .then(function (addresses) {
      var opts = {}
      if (self._lastHeight !== null) {
        opts.from = Math.max(1, self._lastHeight - 10)
      }

      return self.blockchain.addressQuery(addresses, opts)
    })
    .then(function (data) {
      var txids = _.chain(data.transactions)
        .pluck('txid')
        .uniq()
        .filter(function (txid) {
          return self._indexedTxRecords[txid] === undefined
        })
        .value()

      return Promise.map(txids, function (txid) {
        var record = {
          blockHeight: null,
          blockHash: null,
          timestamp: getCurrentTimestamp(),
          isBlockTimestamp: false
        }

        return Promise.all([
          self._wallet.blockchain.getTx(txid),
          self._wallet.getTxBlockHash(txid)
        ])
        .spread(function (rawtx, info) {
          record.rawtx = rawtx

          if (record.source === 'mempool') {
            record.status = TX_STATUS.unconfirmed
            return
          }

          record.status = TX_STATUS.confirmed
          record.blockHeight = info.block.height
          record.blockHash = info.block.hash

          return self._wallet.blockchain.getHeader(record.blockHeight)
            .then(function (header) {
              record.timestamp = header.time
              record.isBlockTimestamp = true
            })
        })
        .then(function () {
          return self._storage.add(txid, record)
        })
        .then(function () {
          record.txid = txid

          return Promise.all([
            self._wallet.coinManager.addTx(record),
            self._wallet.historyManager.addTx(record)
          ])
        })
        .then(function () {
          self._txRecords.push(record)
          self._indexedTxRecords[txid] = record
          self.emit('add', txid)
        })
      })
      .then(function () {
        self._lastHeight = data.latest.height
      })
    })
}

/**
 * @return {Promise}
 */
TxManager.prototype._sync = function () {
  var self = this
  return self.ready
    .then(function () {
      self._syncEnter()
      return self._withLock(function () {
        return Promise.all([
          self._syncKnownTxs(),
          self._syncUnknowTxs()
        ])
        .then(function () {
          self._resortTxRecords()
        })
      })
      .finally(function () {
        self._syncExit()
      })
    })
}

/**
 * @param {string} rawtx
 * @return {Promise}
 */
TxManager.prototype.sendTx = function (rawtx) {
  var self = this
  return self.ready
    .then(function () {
      var tx = new bitcore.Transaction(rawtx)
      var txid = tx.id

      if (self._indexedTxRecords[txid] !== undefined) {
        throw new Error('Transaction already exists')
      }

      var data = {
        rawtx: rawtx,
        status: TX_STATUS.dispatch,
        blockHeight: null,
        blockHash: null,
        timestamp: getCurrentTimestamp(),
        isBlockTimestamp: false
      }

      self._syncEnter()
      return self._withLock(function () {
        return self._storage.add(txid, data)
          .then(function () {
            data.txid = txid

            return Promise.all([
              self._wallet.coinManager.addTx(data),
              self._wallet.historyManager.addTx(data)
            ])
          })
          .then(function () {
            self._txRecords.push(data)
            self._indexedTxRecords[txid] = data
            self.emit('add', txid)
          })
      })
      .finally(function () {
        self._syncExit()
      })
    })
}

/**
 * @param {string} txid
 * @return {Promise.<?string>}
 */
TxManager.prototype.getTx = function (txid) {
  var self = this
  return self._withLock(function () {
    var record = self._indexedTxRecords[txid]
    return record === undefined ? null : record.rawtx
  })
}

/**
 * @param {string} txid
 * @return {Promise.<?ITxStorage~Record>}
 */
TxManager.prototype.getTxInfo = function (txid) {
  var self = this
  return self._withLock(function () {
    var record = self._indexedTxRecords(txid)
    return record === undefined ? null : _.clone(record)
  })
}

module.exports = TxManager
