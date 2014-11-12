var events = require('events')
var inherits = require('util').inherits

var _ = require('lodash')
var Q = require('q')

var bitcoin = require('../bitcoin')
var verify = require('../verify')
var txStatus = require('./const').txStatus


/**
 * @constant
 * @type {number}
 */
var TimezoneOffset = new Date().getTimezoneOffset() * 60

/**
 * @return {number}
 */
function getCurrentTimestamp() {
  return Math.round(Date.now()/1000) + TimezoneOffset
}


/**
 * @event TxDb#error
 * @param {Error} error
 */

/**
 * @event TxDb#addTx
 * @param {Transaction} tx
 */

/**
 * @event TxDb#updateTx
 * @param {string} txId
 */

/**
 * @event TxDb#revertTx
 * @param {Transaction} tx
 */

/**
 * @class TxDb
 * @extends events.EventEmitter
 * @param {TxStorage} txStorage
 * @param {Blockchain} blockchain
 */
function TxDb(txStorage, blockchain) {
  verify.TxStorage(txStorage)
  verify.Blockchain(blockchain)

  var self = this

  events.EventEmitter.call(self)

  self._txStorage = txStorage
  self._blockchain = blockchain

  self._history = {}
  self._historyTx = {}
  self._addTxSync = {}
  self._addTxQueue = {}

  self._txStorage.getAllPendingTxIds().forEach(function(txId) {
    process.nextTick(function() { self._attemptSendTx(txId) })
  })
}

inherits(TxDb, events.EventEmitter)

/**
 * @param {string} txId
 * @param {number} [attempt=0]
 */
TxDb.prototype._attemptSendTx = function(txId, attempt) {
  verify.txId(txId)
  if (_.isUndefined(attempt)) attempt = 0
  verify.number(attempt)

  var self = this

  var record = self._txStorage.getTx(txId)
  if (record === null)
    return

  // No needed change status on success, historySync do it
  var tx = bitcoin.Transaction.fromHex(record.rawTx)
  Q.ninvoke(self._blockchain, 'sendTx', tx).catch(function(error) {
    self.emit('error', error)

    if (attempt >= 5) {
      self._txStorage.updateTx(txId, {status: txStatus.invalid})
      return self.emit('updateTx', txId)
    }

    var timeout = 15000 * Math.pow(2, attempt)
    Q.delay(timeout).then(function() { self._attemptSendTx(txId, attempt + 1) })

  }).done()
}

/**
 * @callback TxDb~errorCallback
 * @param {?Error} error
 */

/**
 * @param {string} txId
 * @param {Object} data
 * @param {number} data.height
 * @param {Transaction} [data.tx]
 * @param {number} [data.status=txStatus.unknown]
 * @param {number} [data.timestamp]
 * @param {TxDb~errorCallback} cb
 */
TxDb.prototype._addTx = function(txId, data, cb) {
  verify.txId(txId)
  verify.object(data)
  verify.number(data.height)
  if (data.tx) verify.Transaction(data.tx)
  if (data.timestamp) verify.number(data.timestamp)
  verify.function(cb)

  if (data.tx) data.rawTx = data.tx.toHex()
  if (_.isUndefined(data.status)) data.status = txStatus.unknown

  var self = this

  if (_.isUndefined(self._addTxQueue[txId]))
    self._addTxQueue[txId] = []

  var promise = Q()
  if (!_.isUndefined(self._addTxSync[txId])) {
    self._addTxQueue[txId].push(Q.defer())
    promise = self._addTxQueue[txId][self._addTxQueue[txId].length - 1].promise
  }
  self._addTxSync[txId] = true

  var record
  promise.then(function() {
    record = self._txStorage.getTx(txId)

    if (_.isUndefined(data.rawTx)) {
      if (record !== null)
        return (data.rawTx = record.rawTx)

      return Q.ninvoke(self._blockchain, 'getTx', txId).then(function(tx) {
        data.rawTx = tx.toHex()
      })
    }

  }).then(function() {
    if (_.isUndefined(data.timestamp)) {
      if (record !== null)
        return (data.timestamp = record.timestamp)

      if (data.height === 0)
        return (data.timestamp = getCurrentTimestamp())

      return Q.ninvoke(self._blockchain, 'getBlockTime', data.height).then(function(ts) {
        data.timestamp = ts
      })
    }

  }).then(function() {
    var opts = {
      status: data.status,
      height: data.height,
      timestamp: data.timestamp
    }

    if (record !== null) {
      self._txStorage.updateTx(txId, opts)
      return self.emit('updateTx', txId)
    }

    self._txStorage.addTx(txId, data.rawTx, opts)
    self.emit('addTx', bitcoin.Transaction.fromHex(data.rawTx))

  }).then(function() {
    cb(null)

  }).catch(function(error) {
    cb(error)

  }).finally(function() {
    delete self._addTxSync[txId]

    var deferred = Q.defer()

    if (!_.isUndefined(self._addTxQueue[txId])) {
      if (self._addTxQueue[txId].length > 0)
        deferred = self._addTxQueue[txId].pop()
      if (self._addTxQueue[txId].length === 0)
        delete self._addTxQueue[txId]
    }

    deferred.resolve()

  }).done()
}

/**
 * @param {Transaction} tx
 * @param {TxDb~errorCallback} cb
 */
TxDb.prototype.sendTx = function(tx, cb) {
  verify.Transaction(tx)

  var self = this

  var txId = tx.getId()
  var addTxOpts = {
    height: 0,
    tx: tx,
    status: txStatus.pending,
    timestamp: getCurrentTimestamp()
  }

  Q.ninvoke(self, '_addTx', txId, addTxOpts).then(function() {
    process.nextTick(function() { self._attemptSendTx(txId) })

  }).done(function() { cb(null) }, function(error) { cb(error) })
}

/**
 * @typedef {Object} HistoryEntry
 * @property {string} txId
 * @property {number} height
 */

/**
 * @param {string} address
 * @param {HistoryEntry[]} entries
 * @param {TxDb~errorCallback} cb
 */
TxDb.prototype.historySync = function(address, entries, cb) {
  verify.string(address)
  verify.array(entries)
  _.pluck(entries, 'txId').forEach(verify.txId)
  _.pluck(entries, 'height').forEach(verify.number)
  verify.function(cb)

  var self = this

  entries = _.chain(entries)
    .uniq('txId')
    .sortBy(function(entry) { return entry.height === 0 ? Infinity : entry.height })
    .value()

  var entriesTxId = {}
  entries.forEach(function(entry) { entriesTxId[entry.txId] = true })

  _.chain(self._history[address] = self._history[address] || {})
    .keys()
    .filter(function(txId) { return _.isUndefined(entriesTxId[txId]) })
    .forEach(function(txId) {
      delete self._history[address][txId]

      self._historyTx[txId] -= 1
      if (self._historyTx[txId] === 0) {
        delete self._historyTx[txId]

        var tx = self._txStorage.removeTx(txId)
        if (tx !== null)
          self.emit('revertTx', tx)
      }
    })

  var promises = entries.map(function(entry) {
    var txId = entry.txId

    if (_.isUndefined(self._history[address][txId])) {
      self._history[address][txId] = true
      self._historyTx[txId] = (self._historyTx[txId] || 0) + 1
    }

    var addTxOpts = {
      height: entry.height,
      status: entry.height === 0 ? txStatus.unconfirmed : txStatus.confirmed
    }

    return Q.ninvoke(self, '_addTx', txId, addTxOpts)
  })

  Q.all(promises).done(function() { cb(null) }, function(error) { cb(error) })
}

/**
 * @param {string} txId
 * @return {?Transaction}
 */
TxDb.prototype.getTx = function(txId) {
  var record = this._txStorage.getTx(txId)
  if (record === null)
    return null

  return bitcoin.Transaction.fromHex(record.rawTx)
}

/**
 * @param {string} txId
 * @return {?boolean}
 */
TxDb.prototype.isTxConfirmed = function(txId) {
  var record = this._txStorage.getTx(txId)
  if (record === null)
    return null

  return record.status === txStatus.confirmed
}

/**
 * @param {string} txId
 * @return {?number}
 */
TxDb.prototype.getTxHeight = function(txId) {
  var record = this._txStorage.getTx(txId)
  if (record === null)
    return null

  return record.height
}

/**
 * @param {string} txId
 * @return {?number}
 */
TxDb.prototype.getTxTimestamp = function(txId) {
  var record = this._txStorage.getTx(txId)
  if (record === null)
    return null

  return record.timestamp
}


module.exports = TxDb
