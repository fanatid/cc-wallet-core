var verify = require('../verify')
var historyEntryType = require('../const').historyEntryType


/**
 * @class HistoryEntry
 *
 * @param {Object} data
 * @param {bitcoinjs-lib.Transaction} data.tx
 * @param {number} data.height
 * @param {number} data.timestamp
 * @param {boolean} data.isBlockTimestamp
 * @param {AssetValue[]} data.values
 * @param {HistoryTarget[]} data.targets
 * @param {number} data.entryType
 */
function HistoryEntry(data) {
  verify.object(data)
  verify.Transaction(data.tx)
  verify.number(data.height)
  verify.number(data.timestamp)
  verify.boolean(data.isBlockTimestamp)
  verify.array(data.values)
  data.values.forEach(verify.AssetValue)
  verify.array(data.targets)
  data.targets.forEach(verify.HistoryTarget)
  verify.number(data.entryType)

  this.txId = data.tx.getId()
  this.height = data.height
  this.timestamp = data.timestamp
  this._isBlockTimestamp = data.isBlockTimestamp
  this.values = data.values
  this.targets = data.targets
  this.entryType = data.entryType
}

/**
 * @return {string}
 */
HistoryEntry.prototype.getTxId = function() {
  return this.txId
}

/**
 * @return {number}
 */
HistoryEntry.prototype.getBlockHeight = function() {
  return this.height
}

/**
 * @return {number}
 */
HistoryEntry.prototype.getTimestamp = function() {
  return this.timestamp
}

/**
 * @return {boolean}
 */
HistoryEntry.prototype.isBlockTimestamp = function () {
  return this._isBlockTimestamp
}

/**
 * @return {AssetValue[]}
 */
HistoryEntry.prototype.getValues = function() {
  return this.values
}

/**
 * @return {AssetTarget[]}
 */
HistoryEntry.prototype.getTargets = function() {
  return this.targets
}

/**
 * @return {boolean}
 */
HistoryEntry.prototype.isSend = function() {
  return this.entryType === historyEntryType.send
}

/**
 * @return {boolean}
 */
HistoryEntry.prototype.isReceive = function() {
  return this.entryType === historyEntryType.receive
}

/**
 * @return {boolean}
 */
HistoryEntry.prototype.isPaymentToYourself = function() {
  return this.entryType === historyEntryType.payment2yourself
}

/**
 * @return {boolean}
 */
HistoryEntry.prototype.isIssue = function() {
  return this.entryType === historyEntryType.issue
}


module.exports = HistoryEntry
