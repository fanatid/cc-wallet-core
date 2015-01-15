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

/**
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 * @param {Object} data
 * @param {number} [data.status=TX_STATUS.unknown]
 * @param {number} data.height
 * @param {string} data.tAddresses
 * @return {external:Q.Promise}
 */
TxManager.prototype.addTx = function (tx, data) {
  verify.Transaction(tx)
  verify.object(data)
  if (_.isUndefined(data.status)) { data.status = TX_STATUS.unknown }
  verify.number(data.status)
  verify.number(data.height)
  verify.string(data.tAddresses)

  var self = this

  var txId = tx.getId()
  if (!_.isUndefined(self._txRecords[txId])) {
    return Q(new errors.AlreadyExistsError('TxId: ' + txId))
  }

  var record = {
    rawTx: tx.toHex(),
    status: data.status,
    height: data.height,
    tAddresses: [data.tAddresses],
    rAddresses: []
  }

  return Q.fcall(function () {
    // Approximate unconfirmed transaction timestamp
    if (record.height === 0) {
      record.timestamp = getCurrentTimestamp()
      record.isBlockTimestamp = false
      return
    }

    return Q.ninvoke(self._wallet.getBlockchain(), 'getBlockTime', record.height).then(function (ts) {
      record.timestamp = ts
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
 * @param {string} [data.tAddress]
 * @return {external:Q.Promise}
 */
TxManager.prototype.updateTx = function (tx, data) {
  verify.Transaction(tx)
  verify.object(data)
  if (!_.isUndefined(data.status)) { verify.number(data.status) }
  if (!_.isUndefined(data.height)) { verify.number(data.height) }
  if (!_.isUndefined(data.tAddress)) { verify.string(data.tAddress) }

  var record = this._txRecords[tx.getId()]
  if (_.isUndefined(record)) {
    return Q(new errors.TxNotFoundError('TxId: ' + tx.getId()))
  }

  var savedRecord = _.cloneDeep(record)

  var mutableStatus = !(
    data.status === TX_STATUS.unconfirmed &&
    [TX_STATUS.dispatch, TX_STATUS.pending].indexOf(record.status) !== -1
  )
  if (mutableStatus && data.status !== record.status) {
    record.status = data.status
  }

  if (data.height !== record.height) {
    record.height = data.height
  }

  if (record.tAddresses.indexOf(data.tAddress) === -1) {
    record.tAddresses = record.tAddresses.concat([data.tAddress]).sort()
  }

  if (!_.isEqual(savedRecord, record)) {
    this.emit('updateTx', Transaction.fromHex(record.rawTx))
  }

  return Q()
}

/**
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 * @param {string} rAddress
 * @return {external:Q.Promise}
 */
TxManager.prototype.revertTx = function (tx, rAddress) {
  verify.Transaction(tx)
  verify.string(rAddress)

  var record = this._txRecords[tx.getId()]
  if (_.isUndefined(record)) {
    return Q(new errors.TxNotFoundError('TxId: ' + tx.getId()))
  }

  record.rAddresses = _.union(record.rAddresses, [rAddress]).sort()
  if (_.isEqual(record.rAddresses, record.tAddresses)) {
    record.status = TX_STATUS.invalid
    this.emit('revertTx', tx)
  }
}

/**
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} tx
 * @return {external:Q.Promise}
 */
TxManager.prototype.sendTx = function (tx) {
  verify.Transaction(tx)

  var txId = tx.getId()
  if (!_.isUndefined(this._txRecords[txId])) {
    return Q(new errors.AlreadyExistsError('TxId: ' + txId))
  }

  this._txRecords[txId] = {
    rawTx: tx.toHex(),
    status: TX_STATUS.dispatch,
    height: 0,
    timestamp: getCurrentTimestamp(),
    isBlockTimestamp: false,
    tAddresses: [],
    rAddresses: []
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
  }

  if (!_.isArray(addresses)) {
    addresses = [addresses]
  }
  verify.array(addresses)
  addresses.forEach(verify.string)

  return _.chain(this._txRecords)
    .map(function (record, txId) {
      if (_.intersection(record.tAddresses, addresses).length > 0) {
        return txId
      }
    })
    .filter()
    .value()
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
 *   status: number,
 *   height: number,
 *   timestamp: number,
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

/**
 * @param {string} txId
 * @param {string} address
 * @return {?boolean}
 */
TxManager.prototype.isTouchedAddress = function (txId, address) {
  verify.txId(txId)
  verify.string(address)

  var record = this._txRecords[txId]
  if (_.isUndefined(record)) {
    return null
  }

  return record.tAddresses.indexOf(address) !== -1
}


module.exports = TxManager
