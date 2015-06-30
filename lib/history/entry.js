'use strict'

var _ = require('lodash')
var bitcore = require('bitcore')

var HISTORY_ENTRY_TYPE = require('../util/const').HISTORY_ENTRY_TYPE

/**
 * @class HistoryEntry
 * @param {Object} data
 * @param {string} data.rawtx
 * @param {number} data.status
 * @param {?number} data.blockHeight
 * @param {number} data.timestamp
 * @param {boolean} data.isBlockTimestamp
 * @param {AssetValue[]} data.values
 * @param {HistoryTarget[]} data.targets
 * @param {number} data.entryType
 */
function HistoryEntry (data) {
  var tx = bitcore.Transaction(data.rawtx)
  this._data = _.defaults({tx: tx, txid: tx.id}, data)
}

/**
 * @param {Object} data
 * @param {number} [data.status]
 * @param {?number} [data.blockHeight]
 */
HistoryEntry.prototype.update = function (data) {
  if (data.status !== undefined) {
    this._data.status = data.status
  }

  if (data.blockHeight !== undefined) {
    this._data.blockHeight = data.blockHeight
  }
}

/**
 * @return {boolean}
 */
HistoryEntry.prototype.isEqual = function (historyEntry) {
  var methods = [
    'getTxId',
    'getTxStatus',
    'getBlockHeight',
    'getTimestamp',
    'isBlockTimestamp'
  ]

  var self = this
  return methods.every(function (method) {
    return self[method].call(self) === historyEntry[method].call(historyEntry)
  })
}

/**
 * @return {bitcoin.Transaction}
 */
HistoryEntry.prototype.getTx = function () {
  return bitcore.Transaction(this._data.tx)
}

/**
 * @return {string}
 */
HistoryEntry.prototype.getTxId = function () {
  return this._data.txid
}

/**
 * @return {number}
 */
HistoryEntry.prototype.getTxStatus = function () {
  return this._data.status
}

/**
 * @return {?number}
 */
HistoryEntry.prototype.getBlockHeight = function () {
  return this._data.blockHeight
}

/**
 * @return {number}
 */
HistoryEntry.prototype.getTimestamp = function () {
  return this._data.timestamp
}

/**
 * @return {boolean}
 */
HistoryEntry.prototype.isBlockTimestamp = function () {
  return this._data.isBlockTimestamp
}

/**
 * @return {AssetValue[]}
 */
HistoryEntry.prototype.getValues = function () {
  return this._data.values.slice()
}

/**
 * @return {HistoryTarget[]}
 */
HistoryEntry.prototype.getTargets = function () {
  return this._data.targets.slice()
}

/**
 * @return {number}
 */
HistoryEntry.prototype.getEntryType = function () {
  return this._data.entryType
}

/**
 * @return {boolean}
 */
HistoryEntry.prototype.isSend = function () {
  return HISTORY_ENTRY_TYPE.isSend(this.getEntryType())
}

/**
 * @return {boolean}
 */
HistoryEntry.prototype.isReceive = function () {
  return HISTORY_ENTRY_TYPE.isReceive(this.getEntryType())
}

/**
 * @return {boolean}
 */
HistoryEntry.prototype.isPaymentToYourself = function () {
  return HISTORY_ENTRY_TYPE.isPayment2yourself(this.getEntryType())
}

/**
 * @return {boolean}
 */
HistoryEntry.prototype.isIssue = function () {
  return HISTORY_ENTRY_TYPE.isIssue(this.getEntryType())
}

module.exports = HistoryEntry
