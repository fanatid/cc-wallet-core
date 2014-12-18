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
  return Math.round(Date.now() / 1000) + TimezoneOffset
}


/**
 * @event TxManager#addTx
 * @param {Transaction} tx
 */

/**
 * @event TxManager#updateTx
 * @param {Transaction} tx
 */

/**
 * @event TxManager#revertTx
 * @param {Transaction} tx
 */

/**
 * @event TxManager#sendTx
 * @param {Transaction} tx
 */

/**
 * @class TxManager
 * @extends events.EventEmitter
 * @mixes SyncMixin
 * @param {Wallet} wallet
 * @param {Object} rawStorage
 */
function TxManager(wallet, rawStorage) {
  verify.Wallet(wallet)
  verify.object(rawStorage)

  events.EventEmitter.call(this)

  this._wallet = wallet
  this._txRecords = rawStorage
}

inherits(TxManager, events.EventEmitter)

/**
 * @param {Transaction} tx
 * @param {Object} data
 * @param {number} [data.status=txStatus.unknown]
 * @param {number} data.height
 * @param {string} data.tAddresses
 * @return {Q.Promise}
 */
TxManager.prototype.addTx = function (tx, data) {
  verify.Transaction(tx)
  verify.object(data)
  if (_.isUndefined(data.status)) { data.status = txStatus.unknown }
  verify.number(data.status)
  verify.number(data.height)
  verify.string(data.tAddresses)

  var self = this

  var txId = tx.getId()
  if (!_.isUndefined(self._txRecords[txId])) {
    return Q(new Error('Same tx already exists'))
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
      return (record.timestamp = getCurrentTimestamp())
    }

    return Q.ninvoke(self._wallet.getBlockchain(), 'getBlockTime', record.height).then(function (ts) {
      record.timestamp = ts + TimezoneOffset
      record.isBlockTimestamp = true
    })

  }).then(function () {
    self._txRecords[txId] = record
    self.emit('addTx', tx)

  })
}

/**
 * @param {Transaction} tx
 * @param {Object} data
 * @param {number} [data.status]
 * @param {number} [data.height]
 * @param {string} [data.tAddress]
 * @return {Q.Promise}
 */
TxManager.prototype.updateTx = function (tx, data) {
  verify.Transaction(tx)
  verify.object(data)
  if (!_.isUndefined(data.status)) { verify.number(data.status) }
  if (!_.isUndefined(data.height)) { verify.number(data.height) }
  if (!_.isUndefined(data.tAddress)) { verify.string(data.tAddress) }

  var record = this._txRecords[tx.getId()]
  if (_.isUndefined(record)) {
    return Q(new Error('Tx not found'))
  }

  var savedRecord = _.cloneDeep(record)

  var mutableStatus = !(
    data.status === txStatus.unconfirmed &&
    [txStatus.dispatch, txStatus.pending].indexOf(record.status) !== -1
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
 * @param {Transaction} tx
 * @param {string} rAddress
 * @return {Q.Promise}
 */
TxManager.prototype.revertTx = function (tx, rAddress) {
  verify.Transaction(tx)
  verify.string(rAddress)

  var record = this._txRecords[tx.getId()]
  if (_.isUndefined(record)) {
    return Q(new Error('Tx not found'))
  }

  record.rAddresses = _.union(record.rAddresses, [rAddress]).sort()
  if (_.isEqual(record.rAddresses, record.tAddresses)) {
    record.status = txStatus.invalid
    this.emit('revertTx', tx)
  }
}

/**
 * @param {Transaction} tx
 * @return {Q.Promise}
 */
TxManager.prototype.sendTx = function (tx) {
  verify.Transaction(tx)

  var txId = tx.getId()
  if (!_.isUndefined(this._txRecords[txId])) {
    return Q(new Error('Same tx already exists'))
  }

  this._txRecords[txId] = {
    rawTx: tx.toHex(),
    status: txStatus.dispatch,
    height: 0,
    timestamp: getCurrentTimestamp(),
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

  if (!_.isArray(addresses)) { addresses = [addresses] }
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
 * @return {?Transaction}
 */
TxManager.prototype.getTx = function (txId) {
  verify.txId(txId)

  var record = this._txRecords[txId]
  return _.isUndefined(record) ? null : Transaction.fromHex(record.rawTx)
}

/**
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

  var record = this._txRecords[txId]
  if (_.isUndefined(record)) {
    return null
  }

  return {
    status: record.status,
    height: record.height,
    timestamp: record.timestamp,
    isBlockTimestamp: record.isBlockTimestamp
  }
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
