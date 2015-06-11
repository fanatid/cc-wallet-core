var _ = require('lodash')
var bitcore = require('bitcore')

/**
 * @class Address
 * @param {string} pubkey
 * @param {Object} [opts]
 * @param {AssetDefinition} [opts.adef]
 * @param {Object} [opts.network=bitcore.Networks.livenet]
 */
function Address (pubkey, opts) {
  opts = _.extend({
    adef: null,
    network: bitcore.Networks.livenet
  }, opts)

  this._adef = opts.adef
  this._address = bitcore.PublicKey(pubkey).toAddress(opts.network).toString()
}

/**
 * @param {string} address
 * @param {AssetDefinition} adef
 * @return {boolean}
 */
Address.checkAddress = function (address, adef) {
  // asset defined, check as colored address
  if (adef !== undefined) {
    var items = address.split('@')

    var isUncoloredBitcoinAsset = items.length === 1 && adef.getId() === 'JNu4AFCBNmTE1'
    var isInvalid = items.length !== 2 || adef.getId() !== items[0]
    if (!isUncoloredBitcoinAsset && isInvalid) {
      return false
    }

    address = _.last(items)
  }

  // check bitcoin address
  try {
    bitcore.encoding.Base58Check.decode(address)
    return true
  } catch (err) {
    return false
  }
}

/**
 * @param {string} address
 * @return {string}
 */
Address.getBitcoinAddress = function (address) {
  return _.last(address.split('@'))
}

/**
 * @return {?AssetDefinition}
 */
Address.prototype.getAssetDefinition = function () {
  return this._adef
}

/**
 * @return {string}
 */
Address.prototype.getAddress = function () {
  return this._address
}

/**
 * @return {string}
 */
Address.prototype.getColorAddress = function () {
  if (this._adef === null) {
    return this._address
  }

  return this._adef.getId() + '@' + this._address
}

module.exports = Address
