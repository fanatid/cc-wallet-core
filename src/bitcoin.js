var bitcoin = require('./cclib').bitcoin
var verify = require('./verify')


/**
 * @param {Buffer} s
 * @return {string}
 */
bitcoin.hashEncode = function (s) {
  return Array.prototype.reverse.call(new Buffer(s)).toString('hex')
}

/**
 * @param {string} s
 * @return {Buffer}
 */
bitcoin.hashDecode = function (s) {
  return Array.prototype.reverse.call(new Buffer(s, 'hex'))
}

/**
 * Revert bytes order
 *
 * @param {string} s
 * @return {string}
 */
function revHex(s) {
  return bitcoin.hashDecode(s).toString('hex')
}

/**
 * @typedef {Object} Header
 * @param {number} version
 * @param {string} prevBlockHash
 * @param {string} merkleRoot
 * @param {number} timestamp
 * @param {number} bits
 * @param {number} nonce
 */

/**
 * @param {Header} header
 * @return {Buffer}
 */
bitcoin.header2buffer = function (header) {
  verify.object(header)
  verify.number(header.version)
  verify.string(header.prevBlockHash)
  verify.length(header.prevBlockHash, 64)
  verify.string(header.merkleRoot)
  verify.length(header.merkleRoot, 64)
  verify.number(header.timestamp)
  verify.number(header.bits)
  verify.number(header.nonce)

  var buffer = new Buffer(80)
  buffer.writeUInt32LE(header.version, 0)
  buffer.write(revHex(header.prevBlockHash), 4, 32, 'hex')
  buffer.write(revHex(header.merkleRoot), 36, 32, 'hex')
  buffer.writeUInt32LE(header.timestamp, 68)
  buffer.writeUInt32LE(header.bits, 72)
  buffer.writeUInt32LE(header.nonce, 76)

  return buffer
}

/**
 * @param {Buffer} buffer
 * @return {Header}
 */
bitcoin.buffer2header = function (buffer) {
  verify.buffer(buffer)
  verify.length(buffer, 80)

  return {
    version: buffer.readUInt32LE(0),
    prevBlockHash: revHex(buffer.slice(4, 36).toString('hex')),
    merkleRoot: revHex(buffer.slice(36, 68).toString('hex')),
    timestamp: buffer.readUInt32LE(68),
    bits: buffer.readUInt32LE(72),
    nonce: buffer.readUInt32LE(76)
  }
}


/**
 * @param {Buffer} buffer
 * @return {Buffer}
 */
bitcoin.headerHash = function (buffer) {
  return Array.prototype.reverse.call(bitcoin.crypto.hash256(buffer))
}


module.exports = bitcoin
