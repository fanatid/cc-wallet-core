var base58 = require('bs58')
var bufferEqual = require('buffer-equal')
var _ = require('lodash')

var bitcoin = require('../bitcoin')
var verify = require('../verify')


/**
 * @class Address
 *
 * @param {AddressManager} addressManager
 * @param {AddressStorageRecord} record
 * @param {Object} network Network description from bitcoinjs-lib.networks
 * @param {number} network.pubKeyHash
 * @param {AssetDefinition} [assetDefinition]
 */
function Address(addressManager, record, network, assetDefinition) {
  verify.AddressManager(addressManager)
  verify.object(record)
  verify.hexString(record.pubKey)
  verify.bitcoinNetwork(network)
  if (!_.isUndefined(assetDefinition)) { verify.AssetDefinition(assetDefinition) }

  this.addressManager = addressManager

  this.pubKey = bitcoin.ECPubKey.fromHex(record.pubKey)
  this.hash = bitcoin.crypto.hash160(this.pubKey.toBuffer())

  this.network = network

  this.assetDefinition = assetDefinition || null
}

/**
 * @param {string} address
 * @return {string}
 */
Address.getBitcoinAddress = function (address) {
  if (address instanceof require('../asset').AssetDefinition) {
    console.warn('assetdef, address in arguments deprecated for removal in 1.0.0, use only address')
    address = arguments[1]
  }

  verify.string(address)
  return _.last(address.split('@'))
}

/**
 * @param {string} address
 * @return {boolean}
 */
Address.checkAddress = function (address) {
  verify.string(address)

  var buffer = new Buffer(base58.decode(address))
  // 1 byte version, 20 hash, 4 checksum
  if (buffer.length !== 25) {
    return false
  }

  var checksum = bitcoin.crypto.hash256(buffer.slice(0, -4)).slice(0, 4)
  return bufferEqual(checksum, buffer.slice(-4))
}

/**
 * @param {AssetDefinition} assetdef
 * @param {string} address
 * @return {boolean}
 */
Address.checkColorAddress = function (assetdef, address) {
  verify.AssetDefinition(assetdef)
  verify.string(address)

  var colordefs = assetdef.getColorDefinitions()
  var isBitcoinAsset = colordefs.length === 1 && colordefs[0].getColorType() === 'uncolored'
  if (!isBitcoinAsset || address.split('@').length > 1) {
    if (assetdef.getId() !== address.split('@')[0]) {
      return false
    }

    address = address.split('@')[1]
  }

  return Address.checkAddress(address)
}

/**
 * @return {external:coloredcoinjs-lib.bitcoin.ECPubKey}
 */
Address.prototype.getPubKey = function () {
  return this.pubKey
}

/**
 * @param {string} seedHex
 * @return {external:coloredcoinjs-lib.bitcoin.ECKey}
 */
Address.prototype.getPrivKey = function (seedHex) {
  verify.hexString(seedHex)
  return this.addressManager.getPrivKeyByAddress(this.getAddress(), seedHex)
}

/**
 * @return {?AssetDefinition}
 */
Address.prototype.getAssetDefinition = function () {
  return this.assetDefinition
}

/**
 * @return {string}
 */
Address.prototype.getAddress = function () {
  var payload = new Buffer(21)
  payload.writeUInt8(this.network.pubKeyHash, 0)
  this.hash.copy(payload, 1)

  var checksum = bitcoin.crypto.hash256(payload).slice(0, 4)

  return base58.encode(Buffer.concat([payload, checksum]))
}

/**
 * @return {string}
 */
Address.prototype.getColorAddress = function () {
  if (this.getAssetDefinition() === null) {
    return this.getAddress()
  }

  return this.getAssetDefinition().getId() + '@' + this.getAddress()
}

/**
 * @memberof Address.prototype
 * @method toString
 * @see {@link Address#getAddress}
 */
Address.prototype.toString = Address.prototype.getAddress


module.exports = Address
