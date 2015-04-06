var events = require('events')
var inherits = require('util').inherits

var _ = require('lodash')
var Q = require('q')

var Transaction = require('../bitcoin').Transaction
var errors = require('../errors')
var verify = require('../verify')
var TX_STATUS = require('../const').TX_STATUS


/**
 * @name TxManager~getCurrentTimestamp
 * @return {number}
 */
function getCurrentTimestamp() {
  return Math.round(Date.now() / 1000)
}


/**
 * @event TxManager#addTx
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 */

/**
 * @event TxManager#updateTx
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 */

/**
 * @event TxManager#revertTx
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 */

/**
 * @event TxManager#sendTx
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 */

/**
 * @class TxManager
 * @extends external:events.EventEmitter
 * @mixes SyncMixin
 * @param {Wallet} wallet
 * @param {WalletState} walletState
 * @param {Object} rawStorage
 */
function TxManager(wallet, walletState, rawStorage) {
  verify.Wallet(wallet)
  verify.WalletState(walletState)
  verify.object(rawStorage)

  events.EventEmitter.call(this)

  rawStorage = _.defaults(rawStorage, {records: {}, version: 1})

  this._wallet = wallet
  this._txRecords = rawStorage.records
}

inherits(TxManager, events.EventEmitter)

// process tx record which comes in TxStateSet format
TxManager.prototype.processTxRecord = function (txr, coinManager, historyManager) {
  var self = this;
  function convertStatus(txr_status) {
    switch (txr_status) {
      case "confirmed": return TX_STATUS.confirmed;
      case "unconfirmed": return TX_STATUS.unconfirmed;
      case "invalid": return TX_STATUS.invalid;
    }
    return TX_STATUS.unknown;
  }
  var status = convertStatus(txr.status);
  var mytxr = this._txRecords[txr.txId]
  var data = { status: status }
  if (TX_STATUS.isConfirmed(status)) {
    data.height = txr.blockHeight;
  }

  if (mytxr) {
    var tx = this.getTx(txr.txId);
    return this.updateTx(tx, data).then(function () {      
      if (TX_STATUS.isValid(mytxr.status) && TX_STATUS.isInvalid(status)) {
        // going from valid to invalid -> need to delect it
        return Q.all([
                       coinManager.revertTx(tx),
                       historyManager.revertTx(tx)]);
      } 
      else 
      if (TX_STATUS.isInvalid(mytxr.status) && TX_STATUS.isValid(status)) {
        // going from invalid to valid -> need to add it
        return Q.all([
                       coinManager.addTx(tx),
                       historyManager.addTx(tx)]);
      }
      return null;
    });
  } else {
    var tx = null;
    return self._wallet.getBlockchain().getTx(txr.txId).then(function (txhex) {
        tx = Transaction.fromHex(txhex);
        return self.addTx(tx, data);
    }).then(function () {
        return Q.all([
                       coinManager.addTx(tx),
                       historyManager.addTx(tx)]);        
    });
  }
  
}


/**
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 * @param {Object} data
 * @param {number} [data.status=TX_STATUS.unknown]
 * @param {number} data.height
 * @return {external:Q.Promise}
 */
TxManager.prototype.addTx = function (tx, data) {
  verify.Transaction(tx)
  verify.object(data)
  if (_.isUndefined(data.status)) { data.status = TX_STATUS.unknown }
  verify.number(data.status)
  verify.number(data.height)

  var self = this

  var txId = tx.getId()
  if (!_.isUndefined(self._txRecords[txId])) {
    return Q.reject(new errors.AlreadyExistsError('TxId: ' + txId))
  }

  var record = {
    rawTx: tx.toHex(),
    status: data.status,
    height: data.height
  }

  return Q.fcall(function () {
    // Approximate unconfirmed transaction timestamp
    if (record.height === 0) {
      record.timestamp = getCurrentTimestamp()
      record.isBlockTimestamp = false
      return
    }

    return self._wallet.getBlockchain().getHeader(record.height)
      .then(function (header) {
        record.timestamp = header.timestamp
        record.isBlockTimestamp = true
      })

  }).then(function () {
    self._txRecords[txId] = record
    self.emit('addTx', tx)

  })
}

/**
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 * @param {Object} data
 * @param {number} [data.status]
 * @param {number} [data.height]
 * @return {external:Q.Promise}
 */
TxManager.prototype.updateTx = function (tx, data) {
  verify.Transaction(tx)
  verify.object(data)
  if (!_.isUndefined(data.status)) { verify.number(data.status) }
  if (!_.isUndefined(data.height)) { verify.number(data.height) }

  var record = this._txRecords[tx.getId()]
  if (_.isUndefined(record)) {
    return Q.reject(new errors.TxNotFoundError('TxId: ' + tx.getId()))
  }

  var savedRecord = _.cloneDeep(record)

  var immutableStatus = (
    TX_STATUS.isUnconfirmed(data.status) &&
    (TX_STATUS.isDispatch(record.status) || TX_STATUS.isPending(record.status))
  )
  if (!immutableStatus && !_.isUndefined(data.status) && data.status !== record.status) {
    record.status = data.status
  }

  if (!_.isUndefined(data.height) && data.height !== record.height) {
    record.height = data.height
  }

  if (!_.isEqual(savedRecord, record)) {
    this.emit('updateTx', Transaction.fromHex(record.rawTx))
  }

  return Q.resolve()
}

/**
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 * @return {external:Q.Promise}
 */
TxManager.prototype.sendTx = function (tx) {
  verify.Transaction(tx)

  var txId = tx.getId()
  if (!_.isUndefined(this._txRecords[txId])) {
    return Q.reject(new errors.AlreadyExistsError('TxId: ' + txId))
  }

  this._txRecords[txId] = {
    rawTx: tx.toHex(),
    status: TX_STATUS.dispatch,
    height: 0,
    timestamp: getCurrentTimestamp(),
    isBlockTimestamp: false
  }

  this.emit('sendTx', tx)
  this.emit('addTx', tx)
}

/**
 * @param {(string|string[])} [addresses]
 * @return {string[]}
 */
TxManager.prototype.getAllTxIds = function (addresses) {
  if (_.isUndefined(addresses)) {
    return _.keys(this._txRecords)
  } else throw new Error("getAllTxIds(addresses) isn't supported")
}

/**
 * @param {string} txId
 * @return {?external:coloredcoinjs-lib.bitcoin.Transaction}
 */
TxManager.prototype.getTx = function (txId) {
  verify.txId(txId)

  var record = this._txRecords[txId]
  return _.isUndefined(record) ? null : Transaction.fromHex(record.rawTx)
}

/**
 * Get status, height, timestamp and isBlockTimestamp for given txId
 *
 * @param {string} txId
 * @return {?{
 *   status:           number,
 *   height:           number,
 *   timestamp:        number,
 *   isBlockTimestamp: boolean
 * }}
 */
TxManager.prototype.getTxData = function (txId) {
  verify.txId(txId)

  var record = this._txRecords[txId] || null
  if (record !== null) {
    record = {
      status: record.status,
      height: record.height,
      timestamp: record.timestamp,
      isBlockTimestamp: record.isBlockTimestamp
    }
  }

  return record
}

/**
 * Get status for given txId
 *
 * @param {string} txId
 * @return {?number}
 */
TxManager.prototype.getTxStatus = function (txId) {
  verify.txId(txId)

  var record = this._txRecords[txId] || null
  return record !== null ? record.status : record
}

module.exports = TxManager
