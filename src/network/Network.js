var events = require('events')
var inherits = require('util').inherits

var Q = require('q')
var zfill = require('zfill')

var bitcoin = require('../bitcoin')
var errors = require('../errors')
var verify = require('../verify')
var util = require('../util')


/**
 * @event Network#error
 * @param {Error} error
 */

/**
 * @event Network#connect
 */

/**
 * @event Network#disconnect
 */

/**
 * @event Network#newHeight
 * @param {number} height
 */

/**
 * @event Network#touchAddress
 * @param {string} address
 */

/**
 * @class Network
 * @extends events.EventEmitter
 */
function Network() {
  var self = this

  events.EventEmitter.call(self)

  self._isConnected = false
  self.on('connect', function () { self._isConnected = true })
  self.on('disconnect', function () { self._isConnected = false })

  self._currentHeight = -1
  self._currentBlockHash = new Buffer(zfill('', 64), 'hex')
}

inherits(Network, events.EventEmitter)

/**
 * @return {boolean}
 */
Network.prototype.supportVerificationMethods = function () {
  return false
}

/**
 * @return {boolean}
 */
Network.prototype.isConnected = function () {
  return this._isConnected
}

/**
 * @param {number} newHeight
 * @return {Q.Promise}
 */
Network.prototype._setCurrentHeight = util.makeSerial(function (newHeight) {
  verify.number(newHeight)

  var self = this

  return self.getHeader(newHeight).then(function (header) {
    header = bitcoin.header2buffer(header)
    self._currentBlockHash = bitcoin.headerHash(header)
    self._currentHeight = newHeight
    self.emit('newHeight', newHeight)

  }).catch(function (error) {
    self.emit('error', error)

  })
}, {returnPromise: true})

/**
 * @return {number}
 */
Network.prototype.getCurrentHeight = function () {
  return this._currentHeight
}

/**
 * @return {Buffer}
 */
Network.prototype.getCurrentBlockHash = function () {
  return this._currentBlockHash
}

/**
 * @typedef {Object} HeaderObject
 * @property {number} version
 * @property {string} prevBlockHash
 * @property {string} merkleRoot
 * @property {number} timestamp
 * @property {number} bits
 * @property {number} nonce
 */

/**
 * @abstract
 * @param {number} height
 * @return {Q.Promise<HeaderObject>}
 */
Network.prototype.getHeader = function () {
  return Q(new errors.NotImplementedError('Network.getHeader'))
}

/**
 * @abstract
 * @param {number} index
 * @return {Q.Promise<string>}
 */
Network.prototype.getChunk = function () {
  return Q(new errors.NotImplementedError('Network.getChunk'))
}

/**
 * @abstract
 * @param {string} txId
 * @return {Q.Promise<Transaction>}
 */
Network.prototype.getTx = function () {
  return Q(new errors.NotImplementedError('Network.getTx'))
}

/**
 * @typedef {Object} MerkleObject
 * @property {number} height
 * @property {string[]} merkle
 * @property {number} index
 */

/**
 * @abstract
 * @param {string} txId
 * @param {number} [height]
 * @return {Q.Promise<MerkleObject>}
 */
Network.prototype.getMerkle = function () {
  return Q(new errors.NotImplementedError('Network.getMerkle'))
}

/**
 * @abstract
 * @param {bitcoinjs-lib.Transaction} tx
 * @return {Q.Promise<string>}
 */
Network.prototype.sendTx = function () {
  return Q(new errors.NotImplementedError('Network.sendTx'))
}

/**
 * @typedef {Object} HistoryEntry
 * @property {string} txId
 * @property {number} height
 */

/**
 * @abstract
 * @param {string} address
 * @return {Q.Promise<HistoryEntry[]>}
 */
Network.prototype.getHistory = function () {
  return Q(new errors.NotImplementedError('Network.getHistory'))
}

/**
 * @typedef {Object} UnspentObject
 * @property {string} txId
 * @property {number} outIndex
 * @property {number} value
 * @property {number} height
 */

/**
 * @abstract
 * @param {string} address
 * @return {Q.Promise<UnspentObject[]>}
 */
Network.prototype.getUnspent = function () {
  return Q(new errors.NotImplementedError('Network.getUnspent'))
}

/**
 * @abstract
 * @param {string} address
 * @return {Q.Promise}
 */
Network.prototype.subscribeAddress = function () {
  return Q(new errors.NotImplementedError('Network.subscribeAddress'))
}


module.exports = Network
