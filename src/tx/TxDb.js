var events = require('events')
var inherits = require('util').inherits

var _ = require('lodash')
var Q = require('q')

var bitcoin = require('../bitcoin')
var verify = require('../verify')


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
 * @readonly
 * @enum {number}
 */
var txStatus = {
  unknown: 0,
  unconfirmed: 1,
  confirmed: 2,
  invalid: 3
}


/**
 * @event TxDb#addTx
 * @param {Transaction} tx
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

  events.EventEmitter.call(this)

  this._txStorage = txStorage
  this._blockchain = blockchain

  this._history = {}
  this._historyTx = {}
  this._addTxSync = {}
  this._addTxQueue = {}
}

inherits(TxDb, events.EventEmitter)

/**
 * @callback TxDb~errorCallback
 * @param {?Error} error
 */

/**
 * @param {Transaction} tx
 * @param {Object} [data]
 * @param {number} [data.timestamp]
 * @param {TxDb~errorCallback} cb
 */
TxDb.prototype.addUnconfirmedTx = function(tx, data, cb) {
  if (_.isFunction(data) && _.isUndefined(cb)) {
    cb = data
    data = undefined
  }
  data = _.extend({
    height: 0,
    tx: tx,
    timestamp: getCurrentTimestamp()
  }, data)

  verify.object(data)
  verify.Transaction(data.tx)
  verify.number(data.timestamp)
  verify.function(cb)

  this.addTx(tx.getId(), data, cb)
}

/**
 * @param {string} txId
 * @param {Object} data
 * @param {number} data.height
 * @param {Transaction} [data.tx]
 * @param {number} [data.timestamp]
 * @param {TxDb~errorCallback} cb
 */
TxDb.prototype.addTx = function(txId, data, cb) {
  verify.txId(txId)
  verify.object(data)
  verify.number(data.height)
  if (data.tx) verify.Transaction(data.tx)
  if (data.timestamp) verify.number(data.timestamp)
  verify.function(cb)

  if (data.tx) data.rawTx = data.tx.toHex()
  data.status = data.height === 0 ? txStatus.unconfirmed : txStatus.confirmed

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
        data.tx = tx
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
      blockHeight: data.height,
      timestamp: data.timestamp
    }

    if (record !== null)
      return self._txStorage.updateTx(txId, opts)

    self._txStorage.addTx(txId, data.rawTx, opts)
    self.emit('addTx', data.tx)

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
  var entriesTxId = _.indexBy(entries, 'txId')

  _.chain(self._history[address] = self._history[address] || {})
    .keys()
    .filter(function(txId) { return !_.isUndefined(entriesTxId[txId]) })
    .forEach(function(txId) {
      delete self._history[address][txId]

      self._historyTx[txId] -= 1
      if (self._historyTx[txId] === 0) {
        delete self._historyTx[txId]

        var tx = this._txStorage.removeTx(txId)
        if (tx !== null)
          this.emit('revertTx', tx)
      }
    })

  var promises = _.chain(entries)
    .uniq()
    .sortBy(function(entry) { return entry.height === 0 ? Infinity : entry.height })
    .map(function(entry) {
      var txId = entry.txId

      if (_.isUndefined(self._history[address][txId])) {
        self._history[address][txId] = true
        self._historyTx[txId] = (self._historyTx[txId] || 0) + 1
      }

      return Q.ninvoke(self, 'addTx', txId, { height: entry.height })
    })
    .value()

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

  return record.height !== 0
}

/**
 * @param {string} txId
 * @return {?number}
 */
TxDb.prototype.getTxBlockHeight = function(txId) {
  var record = this._txStorage.getTx(txId)
  if (record === null)
    return null

  return record.blockHeight
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
