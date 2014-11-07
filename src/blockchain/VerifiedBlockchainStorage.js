var inherits = require('util').inherits

var _ = require('lodash')

var verify = require('../verify')
var SyncStorage = require('../SyncStorage')


/**
 * @class VerifiedBlockchainStorage
 * @extends SyncStorage
 *
 * hashes: sha256(sha256(chunkHex)) hashes in one string
 * headers: headerHex headers in one string
 * lastHash: sha256(sha256(lastHeaderHex))
 */
function VerifiedBlockchainStorage() {
  SyncStorage.apply(this, Array.prototype.slice.call(arguments))

  this.blockchainDbKey = this.globalPrefix + 'verifiedBlockchain'
  this.blockchainData = this.store.get(this.blockchainDbKey)
  if (_.isUndefined(this.blockchainData))
    this.blockchainData = { lastHash: new Buffer(32).fill(0).toString('hex'), hashes: '', headers: '' }

  if (_.isUndefined(this.store.get(this.blockchainDbKey + '_version')))
    this.store.set(this.blockchainDbKey + '_version', '1')
}

inherits(VerifiedBlockchainStorage, SyncStorage)

/**
 * @return {{headers: string, hashes: string}}
 */
VerifiedBlockchainStorage.prototype._getData = function() {
  return this.blockchainData
}

/**
 * @param {{headers: string, hashes: string}} data
 */
VerifiedBlockchainStorage.prototype._saveData = function(data) {
  this.store.set(this.blockchainDbKey, data)
  this.blockchainData = data
}

/**
 * @return {string}
 */
VerifiedBlockchainStorage.prototype.getLastHash = function() {
  return this._getData().lastHash
}

/**
 * @param {string} lastHash
 */
VerifiedBlockchainStorage.prototype.setLastHash = function(lastHash) {
  verify.hexString(lastHash)
  verify.length(lastHash, 64)

  var data = this._getData()
  data.lastHash = lastHash
  this._saveData(data)
}

/**
 * @return {number}
 */
VerifiedBlockchainStorage.prototype.getChunksCount = function() {
  return this._getData().hashes.length / 64
}

/**
 * @param {number} offset
 * @return {string}
 */
VerifiedBlockchainStorage.prototype.getChunkHash = function(offset) {
  verify.number(offset)

  return this._getData().hashes.slice(offset*64, (offset+1)*64)
}

/**
 * @param {string} hash
 */
VerifiedBlockchainStorage.prototype.pushChunkHash = function(hash) {
  verify.hexString(hash)
  verify.length(hash, 64)

  var data = this._getData()
  data.hashes += hash
  this._saveData(data)
}

/**
 * @param {number} offset
 */
VerifiedBlockchainStorage.prototype.truncateChunks = function(offset) {
  verify.number(offset)

  var data = this._getData()
  data.hashes = data.hashes.slice(0, offset*64)
  this._saveData(data)
}

/**
 * @return {number}
 */
VerifiedBlockchainStorage.prototype.getHeadersCount = function() {
  return this._getData().headers.length / 160
}

/**
 * @param {number} offset
 * @return {string}
 */
VerifiedBlockchainStorage.prototype.getHeader = function(offset) {
  verify.number(offset)

  return this._getData().headers.slice(offset*160, (offset+1)*160)
}

/**
 * @param {string} header
 */
VerifiedBlockchainStorage.prototype.pushHeader = function(header) {
  verify.hexString(header)
  verify.length(header, 160)

  var data = this._getData()
  data.headers += header
  this._saveData(data)
}

/**
 * @param {number} offset
 */
VerifiedBlockchainStorage.prototype.truncateHeaders = function(offset) {
  verify.number(offset)

  var data = this._getData()
  data.headers = data.headers.slice(0, offset*160)
  this._saveData(data)
}

/**
 */
VerifiedBlockchainStorage.prototype.clear = function() {
  this.store.remove(this.blockchainDbKey)
  this.store.remove(this.blockchainDbKey + '_version')
}


module.exports = VerifiedBlockchainStorage
