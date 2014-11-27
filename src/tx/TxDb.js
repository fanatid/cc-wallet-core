var events = require('events')
var inherits = require('util').inherits

var _ = require('lodash')
var Q = require('q')

var Transaction = require('../bitcoin').Transaction
var verify = require('../verify')
var txStatus = require('../const').txStatus


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
 * @param {string} tx
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
function TxDb(wallet, txStorage) {
  verify.Wallet(wallet)
  verify.TxStorage(txStorage)

  var self = this

  events.EventEmitter.call(self)

  self._wallet = wallet
  self._txStorage = txStorage

  self._addTxSync = {}
  self._addTxQueue = {}

  self._txStorage.getAllTxIds().forEach(function(txId) {
    var record = self._txStorage.get(txId)
    if (record !== null && record.status === txStatus.dispatch)
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

  var record = self._txStorage.get(txId)
  if (record === null)
    return

  /**
   * @param {number} status
   */
  function updateTx(status) {
    self._txStorage.update(txId, {status: status})
    self.emit('updateTx', tx)
  }

  var tx = Transaction.fromHex(record.rawTx)
  Q.ninvoke(self._wallet.getBlockchain(), 'sendTx', tx).done(function () {
    updateTx(txStatus.pending)

  }, function(error) {
    self.emit('error', error)

    if (attempt >= 5) {
      return updateTx(txStatus.invalid)
    }

    var timeout = 15000 * Math.pow(2, attempt)
    Q.delay(timeout).then(function() { self._attemptSendTx(txId, attempt + 1) })

  })
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
 * @param {string[]} [data.tAddresses]
 * @param {TxDb~errorCallback} cb
 */
TxDb.prototype._addTx = function(txId, data, cb) {
  verify.txId(txId)
  verify.object(data)
  verify.number(data.height)
  if (data.tx) verify.Transaction(data.tx)
  if (data.timestamp) verify.number(data.timestamp)
  if (data.tAddresses) verify.array(data.tAddresses)
  if (data.tAddresses) data.tAddresses.forEach(verify.string)
  verify.function(cb)

  if (data.tx) data.rawTx = data.tx.toHex()

  var self = this

  var deferred = Q.defer()
  deferred.promise.done(function() { cb(null) }, function(error) { cb(error) })

  if (_.isUndefined(self._addTxQueue[txId]))
    self._addTxQueue[txId] = []

  var promise = Q()
  if (!_.isUndefined(self._addTxSync[txId])) {
    self._addTxQueue[txId].push(Q.defer())
    promise = _.last(self._addTxQueue[txId]).promise
  }
  self._addTxSync[txId] = true

  var record
  promise.then(function() {
    record = self._txStorage.get(txId)

    if (_.isUndefined(data.rawTx)) {
      if (record !== null)
        return (data.rawTx = record.rawTx)

      return Q.ninvoke(self._wallet.getBlockchain(), 'getTx', txId).then(function(tx) {
        data.rawTx = tx.toHex()
      })
    }

  }).then(function() {
    if (_.isUndefined(data.timestamp)) {
      if (record !== null)
        return (data.timestamp = record.timestamp)

      // Approximate unconfirmed transaction timestamp
      if (data.height === 0)
        return (data.timestamp = getCurrentTimestamp())

      return Q.ninvoke(self._wallet.getBlockchain(), 'getBlockTime', data.height).then(function(ts) {
        data.timestamp = ts + TimezoneOffset
      })
    }

  }).then(function() {
    if (_.isUndefined(data.status)) data.status = txStatus.unknown
    if (record !== null && record.status === txStatus.pending && data.status === txStatus.unconfirmed)
      data.status = txStatus.pending

    if (_.isUndefined(data.tAddresses)) data.tAddresses = []
    if (record !== null)
      data.tAddresses = _.union(data.tAddresses, record.tAddresses)

    var opts = {
      status: data.status,
      height: data.height,
      timestamp: data.timestamp,
      tAddresses: data.tAddresses
    }

    if (record !== null) {
      var isEqual = _.every(opts, function(v, k) { return _.isEqual(record[k], v) })
      if (isEqual)
        return

      self._txStorage.update(txId, opts)
      return self.emit('updateTx', Transaction.fromHex(data.rawTx))
    }

    self._txStorage.add(txId, data.rawTx, opts)
    self.emit('addTx', Transaction.fromHex(data.rawTx))

  }).then(function() {
    deferred.resolve()

  }).catch(function(error) {
    deferred.reject(error)

  }).finally(function() {
    if (self._addTxQueue[txId].length === 0) {
      delete self._addTxQueue[txId]
      delete self._addTxSync[txId]

    } else {
      self._addTxQueue[txId].shift().resolve()

    }

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
// Yes, I save empty addresses array, they will be filled in historySync
//   if transaction will be accepted or will be empty if tx is invalid :-(
  var addTxOpts = {
    height: 0,
    tx: tx,
    status: txStatus.dispatch,
    timestamp: getCurrentTimestamp(),
    tAddresses: []
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

  _.chain(self._txStorage.getAllTxIds())
    .filter(function(txId) { return _.isUndefined(entriesTxId[txId]) })
    .forEach(function(txId) {
      var record = self._txStorage.removeTouchedAddress(txId, address)
      if (record === null || !_.isEqual(record.tAddresses, record.rAddresses))
        return

      record = self._txStorage.update(txId, {status: txStatus.invalid})
      if (record !== null)
        self.emit('revertTx', Transaction.fromHex(record.rawTx))
    })

  var promises = entries.map(function(entry) {
    var addTxOpts = {
      height: entry.height,
      status: entry.height === 0 ? txStatus.unconfirmed : txStatus.confirmed,
      tAddresses: [address]
    }

    // Todo:
    // How add tx if they was marked as invalid because was aborted in revert case
    //   and now re-created with equals params and have same txId... ?
    // Example:
    // Create tx with txId1
    // Included in block #zzz
    // On block #zzz+2 network make revert to #zzz-1 and not include tx with txId1 (can this happen?)
    // Re-create tx with txId1
    // In our db txId1 alrady marked as invalid...
    return Q.ninvoke(self, '_addTx', entry.txId, addTxOpts)
  })

  Q.all(promises).done(function() { cb(null) }, function(error) { cb(error) })
}

/**
 * @return {string[]}
 */
TxDb.prototype.getAllTxIds = function() {
  return this._txStorage.getAllTxIds()
}

/**
 * @param {string} txId
 * @return {?Transaction}
 */
TxDb.prototype.getTx = function(txId) {
  var record = this._txStorage.get(txId)
  return record === null ? null : Transaction.fromHex(record.rawTx)
}

/**
 * @param {string} txId
 * @return {?number}
 */
TxDb.prototype.getTxStatus = function(txId) {
  var record = this._txStorage.get(txId)
  return record === null ? null : record.status
}

/**
 * @param {string} txId
 * @return {?number}
 */
TxDb.prototype.getTxHeight = function(txId) {
  var record = this._txStorage.get(txId)
  return record === null ? null : record.height
}

/**
 * @param {string} txId
 * @return {?number}
 */
TxDb.prototype.getTxTimestamp = function(txId) {
  var record = this._txStorage.get(txId)
  return record === null ? null : record.timestamp
}


module.exports = TxDb
