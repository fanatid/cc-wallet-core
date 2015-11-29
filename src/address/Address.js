var _ = require('lodash')
var bitcore = require('bitcore-lib')

/**
 * @class Address
 *
 * @param {AddressManager} addressManager
 * @param {AddressStorageRecord} record
 * @param {Object} network
 * @param {AssetDefinition} [assetDefinition]
 */
function Address (addressManager, record, network, assetDefinition) {
  this.addressManager = addressManager

  this.publicKey = bitcore.PublicKey(record.pubKey)
  this.network = network
  this.assetDefinition = assetDefinition || null
}

/**
 * @param {string} address
 * @return {string}
 */
Address.getBitcoinAddress = function (address) {
  return _.last(address.split('@'))
}

/**
 * @param {string} address
 * @return {boolean}
 */
Address.checkAddress = function (address) {
  try {
    bitcore.encoding.Base58Check.decode(address)
    return true
  } catch (err) {
    return false
  }
}

/**
 * @param {AssetDefinition} assetdef
 * @param {string} address
 * @return {boolean}
 */
Address.checkColorAddress = function (assetdef, address) {
  var descs = assetdef.getColorSet().getColorDescs()
  var isBitcoinAsset = descs.length === 1 && descs[0] === ''
  if (!isBitcoinAsset || address.split('@').length > 1) {
    if (assetdef.getId() !== address.split('@')[0]) {
      return false
    }

    address = address.split('@')[1]
  }

  return Address.checkAddress(address)
}

/**
 * @return {bitcore.PublicKey}
 */
Address.prototype.getPubKey = function () {
  return this.publicKey
}

/**
 * @param {string} seedHex
 * @return {bitcore.PrivateKey}
 */
Address.prototype.getPrivKey = function (seedHex) {
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
  return this.publicKey.toAddress(this.network).toString()
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
