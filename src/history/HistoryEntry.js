var verify = require('../verify')


/**
 * @class HistoryEntry
 *
 * @param {Object} data
 * @param {bitcoinjs-lib.Transaction} data.tx
 * @param {number} data.blockHeight
 * @param {number} data.timestamp
 * @param {AssetValue[]} data.values
 * @param {HistoryTarget[]} data.targets
 * @param {number} data.entryType
 */
function HistoryEntry(data) {
  verify.object(data)
  verify.Transaction(data.tx)
  verify.number(data.blockHeight)
  verify.number(data.timestamp)
  verify.array(data.values)
  data.values.forEach(verify.AssetValue)
  verify.array(data.targets)
  data.targets.forEach(verify.HistoryTarget)
  verify.number(data.entryType)

  this.txId = data.tx.getId()
  this.blockHeight = data.blockHeight
  this.timestamp = data.timestamp
  this.values = data.values
  this.targets = data.targets
  this.entryType = data.entryType
}

HistoryEntry.entryTypes = {
  Send: 0,
  Receive: 1,
  PaymentToYourself: 2,
  Issue: 3
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
  return this.blockHeight
}

/**
 * @return {number}
 */
HistoryEntry.prototype.getTimestamp = function() {
  return this.timestamp
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
  return this.entryType === HistoryEntry.entryTypes.Send
}

/**
 * @return {boolean}
 */
HistoryEntry.prototype.isReceive = function() {
  return this.entryType === HistoryEntry.entryTypes.Receive
}

/**
 * @return {boolean}
 */
HistoryEntry.prototype.isPaymentToYourself = function() {
  return this.entryType === HistoryEntry.entryTypes.PaymentToYourself
}

/**
 * @return {boolean}
 */
HistoryEntry.prototype.isIssue = function() {
  return this.entryType === HistoryEntry.entryTypes.Issue
}


module.exports = HistoryEntry
