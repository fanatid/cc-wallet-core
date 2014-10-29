var _ = require('lodash')
var LRU = require('lru-cache')
var Q = require('q')

var bitcoin = require('../bitcoin')
var verify = require('../verify')


var RecheckInterval = 60 * 1000

/**
 * @class BaseTxDb
 *
 * @param {Wallet} wallet
 * @param {TxStorage} storage
 */
// Todo: blockchain reorg and double-spending
function BaseTxDb(wallet, storage) {
  verify.Wallet(wallet)
  verify.TxStorage(storage)

  this.wallet = wallet
  this.storage = storage

  this.lastStatusCheck = LRU({ maxAge: RecheckInterval })
}

BaseTxDb.TxStatusUnknown = 0
BaseTxDb.TxStatusUnconfirmed = 1
BaseTxDb.TxStatusConfirmed = 2
BaseTxDb.TxStatusInvalid = 3

/**
 * @callback BaseTxDb~errorCallback
 * @param {?Error} error
 */

/**
 * @param {Object} data
 * @param {bitcoinjs-lib.Transaction} data.tx
 * @param {number} [data.timestamp]
 * @param {BaseTxDb~errorCallback} cb
 */
BaseTxDb.prototype.addUnconfirmedTx = function(data, cb) {
  verify.object(data)

  data = _.extend(data, { status: BaseTxDb.TxStatusUnconfirmed })
  this.addTx(data, cb)
}

/**
 * @param {Object} data
 * @param {bitcoinjs-lib.Transaction} data.tx
 * @param {number} [data.status]
 * @param {number} [data.timestamp]
 * @param {BaseTxDb~errorCallback} cb
 */
BaseTxDb.prototype.addTx = function(data, cb) {
  verify.object(data)
  verify.Transaction(data.tx)
  if (data.status) verify.number(data.status)
  if (data.timestamp) verify.number(data.timestamp)
  verify.function(cb)

  var self = this

  Q.fcall(function() {
    var txId = data.tx.getId()

    var record = self.storage.getByTxId(txId)
    if (record !== null)
      return Q.ninvoke(self, 'maybeRecheckTxStatus', record.txId, record.status)

    return Q.fcall(function() {
      if (_.isUndefined(data.status))
        return Q.ninvoke(self, 'identifyTxStatus', txId)
      return data.status

    }).then(function(status) {
      self.storage.addTx(txId, data.tx.toHex(), status, data.timestamp)
      return Q.ninvoke(self, 'updateTxInfo', txId, status)

    }).then(function() {
      self.lastStatusCheck.set(txId, true)
      return Q.ninvoke(self.wallet.getCoinManager(), 'applyTx', data.tx)

    })

  }).done(function() { cb(null) }, function(error) { cb(error) })
}

/**
 * @param {string} txId
 * @return {?bitcoinjs-lib.Transaction}
 */
BaseTxDb.prototype.getTxById = function(txId) {
  verify.txId(txId)

  var record = this.storage.getByTxId(txId)
  if (record === null)
    return null

  return bitcoin.Transaction.fromHex(record.rawTx)
}

/**
 * @param {string} txId
 * @return {?number}
 */
BaseTxDb.prototype.getBlockHeightByTxId = function(txId) {
  verify.txId(txId)

  var record = this.storage.getByTxId(txId)
  if (record === null)
    return null

  return record.blockHeight
}

/**
 * @param {string} txId
 * @return {?number}
 */
BaseTxDb.prototype.getTimestampByTxId = function(txId) {
  verify.txId(txId)

  var record = this.storage.getByTxId(txId)
  if (record === null)
    return null

  return record.timestamp
}

/**
 * @param {string} txId
 * @param {number} status
 * @param {BaseTxDb~errorCallback} cb
 */
BaseTxDb.prototype.maybeRecheckTxStatus = function(txId, status, cb) {
  verify.txId(txId)
  verify.number(status)
  verify.function(cb)

  var self = this

  Q.fcall(function() {
    if (status === BaseTxDb.TxStatusConfirmed &&
        !_.isUndefined(self.storage.getByTxId(txId).timestamp))
      return

    if (!_.isUndefined(self.lastStatusCheck.get(txId)))
      return

    self.lastStatusCheck.set(txId, true)

    return Q.ninvoke(self, 'identifyTxStatus', txId).then(function(status) {
      self.storage.setTxStatus(txId, status)
      return Q.ninvoke(self, 'updateTxInfo', txId, status)

    })

  }).done(function() { cb(null) }, function(error) { cb(error) })
}

/**
 * @param {string} txId
 * @param {number} status
 * @param {BaseTxDb~errorCallback} cb
 */
BaseTxDb.prototype.updateTxInfo = function(txId, status, cb) {
  verify.txId(txId)
  verify.number(status)
  verify.function(cb)

  var self = this

  Q.fcall(function() {
    if (status !== BaseTxDb.TxStatusConfirmed)
      return

    return Q.fcall(function() {
      return Q.ninvoke(self.wallet.getBlockchain(), 'getTxBlockHash', txId)

    }).then(function(blockHash) {
      var promise = Q()

      if (_.isUndefined(self.storage.getByTxId(txId).timestamp))
        promise = promise.then(function() {
          return Q.ninvoke(self.wallet.getBlockchain(), 'getBlockTime', blockHash)

        }).then(function(timestamp) {
          self.storage.setTimestamp(txId, timestamp)

        })

      promise = promise.then(function() {
        return Q.ninvoke(self.wallet.getBlockchain(), 'getBlockHeight', blockHash)

      }).then(function(height) {
        self.storage.setBlockHeight(txId, height)

      })

      return promise
    })

  }).done(function() { cb(null) }, function(error) { cb(error) })
}

/**
 * @callback BaseTxDb~isTxConfirmed
 * @param {Error} error
 * @param {boolean} isConfirmed
 */

/**
 * @param {string} txId
 * @param {BaseTxDb~isTxConfirmed} cb
 */
BaseTxDb.prototype.isTxConfirmed = function(txId, cb) {
  verify.txId(txId)
  verify.function(cb)

  var self = this

  Q.fcall(function() {
    var record = self.storage.getByTxId(txId)
    if (record === null)
      throw new Error('Tx not found')

    return record.status

  }).then(function(status) {
    if (status === BaseTxDb.TxStatusConfirmed)
      return status

    return Q.ninvoke(self, 'maybeRecheckTxStatus', txId, status)

  }).then(function(status) {
    return status === BaseTxDb.TxStatusConfirmed

  }).done(function(isConfirmed) { cb(null, isConfirmed) }, function(error) { cb(error) })
}

/**
 * @callback BaseTxDb~isTxValid
 * @param {Error} error
 * @param {boolean} isValid
 */

/**
 * @param {string} txId
 * @param {BaseTxDb~isTxValid} cb
 */
BaseTxDb.prototype.isTxValid = function(txId, cb) {
  verify.txId(txId)
  verify.function(cb)

  var self = this

  Q.fcall(function() {
    var record = self.storage.getTxById(txId)
    if (record === null)
      throw new Error('Tx not found')

    return record.status

  }).then(function(status) {
    if (status === BaseTxDb.TxStatusConfirmed)
      return status

    return Q.ninvoke(self, 'maybeRecheckTxStatus', txId, status)

  }).then(function(status) {
    return status !== BaseTxDb.TxStatusInvalid

  }).done(function(isValid) { cb(isValid) }, function(error) { cb(error) })
}


module.exports = BaseTxDb
