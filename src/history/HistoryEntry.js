var _ = require('lodash')

var verify = require('../verify')
var HISTORY_ENTRY_TYPE = require('../const').HISTORY_ENTRY_TYPE


/**
 * @class HistoryEntry
 *
 * @param {Object} data
 * @param {external:coloredcoinjs-lib.bitcoin.Transaction} data.tx
 * @param {Object} data.txData
 * @param {number} data.txData.status
 * @param {number} data.txData.height
 * @param {number} data.txData.timestamp
 * @param {boolean} data.txData.isBlockTimestamp
 * @param {AssetValue[]} data.values
 * @param {HistoryTarget[]} data.targets
 * @param {number} data.entryType
 */
function HistoryEntry(data) {
  verify.object(data)
  verify.Transaction(data.tx)
  verify.object(data.txData)
  verify.number(data.txData.status)
  verify.number(data.txData.height)
  verify.number(data.txData.timestamp)
  verify.boolean(data.txData.isBlockTimestamp)
  verify.array(data.values)
  data.values.forEach(verify.AssetValue)
  verify.array(data.targets)
  data.targets.forEach(verify.HistoryTarget)
  verify.number(data.entryType)

  // Make clone deep? Colud damage values, targets
  this._data = data
  this._data.txId = this._data.tx.getId()
}

/**
 * @return {boolean}
 */
HistoryEntry.prototype.isEqual = function (historyEntry) {
  verify.HistoryEntry(historyEntry)

  function getData(he) {
    return {
      txId:             he.getTxId(),
      status:           he.getTxStatus(),
      height:           he.getBlockHeight(),
      timestamp:        he.getTimestamp(),
      isBlockTimestamp: he.isBlockTimestamp()
    }
  }

  return _.isEqual(getData(this), getData(historyEntry))
}

/**
 * @return {external:coloredcoinjs-lib.bitcoin.Transaction}
 */
HistoryEntry.prototype.getTx = function () {
  return this._data.tx
}

/**
 * @return {string}
 */
HistoryEntry.prototype.getTxId = function () {
  return this._data.txId
}

/**
 * @return {number}
 */
HistoryEntry.prototype.getTxStatus = function () {
  return this._data.txData.status
}

/**
 * @return {number}
 */
HistoryEntry.prototype.getBlockHeight = function () {
  return this._data.txData.height
}

/**
 * @return {number}
 */
HistoryEntry.prototype.getTimestamp = function () {
  return this._data.txData.timestamp
}

/**
 * @return {boolean}
 */
HistoryEntry.prototype.isBlockTimestamp = function () {
  return this._data.txData.isBlocTimestamp
}

/**
 * @return {AssetValue[]}
 */
HistoryEntry.prototype.getValues = function () {
  return this._data.values
}

/**
 * @return {AssetTarget[]}
 */
HistoryEntry.prototype.getTargets = function () {
  return this._data.targets
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
