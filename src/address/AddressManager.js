var events = require('events')
var inherits = require('util').inherits
var _ = require('lodash')
var cclib = require('coloredcoinjs-lib')
var bitcore = require('bitcore-lib')

var Address = require('./Address')
var AssetDefinition = require('../asset').AssetDefinition
var errors = require('../errors')

var UNCOLORED_CHAIN = 0
var EPOBC_CHAIN = 826130763

/**
 * @private
 * @param {(function|external:coloredcoinjs-lib.ColorDefinition|AssetDefinition)} definition
 * @return {number}
 * @throws {MultiColorNotSupportedError|VerifyColorDefinitionTypeError}
 */
function selectChain (definition) {
  /*
  if (definition instanceof AssetDefinition) {
    var colordefs = definition.getColorSet().getColorDefinitions()
    if (colordefs.length !== 1) {
      throw new errors.MultiColorNotSupportedError('Attempt selectChain for multi-color AssetDefinition')
    }

    definition = colordefs[0]
  }

  if (definition instanceof cclib.definitions.Interface) {
    definition = definition.constructor
  }

  if (definition === cclib.definitions.Uncolored) {
    return UNCOLORED_CHAIN
  }

  if (definition === cclib.definitions.EPOBC) {
    return EPOBC_CHAIN
  }

  throw new errors.VerifyColorDefinitionTypeError('Type: ' + definition)
  */
  // not good.. '(
  var desc = null
  if (definition instanceof AssetDefinition) {
    var descs = definition.getColorSet().getColorDescs()
    if (descs.length !== 1) {
      throw new errors.MultiColorNotSupportedError('Attempt selectChain for multi-color AssetDefinition')
    }

    desc = descs[0]
  } else if (definition instanceof cclib.definitions.Interface) {
    desc = definition.getDesc()
  }

  if (definition === cclib.definitions.Uncolored || desc === '') {
    return UNCOLORED_CHAIN
  }

  if (definition === cclib.definitions.EPOBC || desc.match(/epobc:[0-9a-zA-Z]{64}:\d{1,}:\d{1,}/) !== null) {
    return EPOBC_CHAIN
  }

  throw new errors.VerifyColorDefinitionTypeError('Type: ' + definition)
}

/**
 * @event AddressManager#newAddress
 * @param {Address} address
 */

/**
 * @class AddressManager
 * @extends EventEmitter
 * @param {AddressStorage} storage
 * @param {Object} network Network description from bitcoinjs-lib.networks
 */
function AddressManager (storage, network) {
  events.EventEmitter.call(this)

  this.storage = storage
  this.network = network
  this.debug = false
}

inherits(AddressManager, events.EventEmitter)

/**
 * @param {string} seedHex
 * @return {boolean}
 */
AddressManager.prototype.isCurrentSeed = function (seedHex) {
  var oldZeroPubKeys = _.sortBy(this.storage.getAll(UNCOLORED_CHAIN), 'index')
  if (oldZeroPubKeys.length === 0) {
    return this.storage.getAll().length === 0
  }

  var newZeroPubKey = bitcore.HDPrivateKey.fromSeed(seedHex, this.network)
    .derive("m/0'/" + UNCOLORED_CHAIN + "'/0")
    .privateKey
    .publicKey
    .toString()

  return oldZeroPubKeys[0].pubKey === newZeroPubKey
}

/**
 * @param {string} seedHex
 * @throws {VerifySeedHexError}
 */
AddressManager.prototype.isCurrentSeedCheck = function (seedHex) {
  if (!this.debug) {
    return
  }

  if (!this.isCurrentSeed(seedHex)) {
    throw new errors.VerifySeedHexError()
  }
}

/**
 * Get new address and save it to db
 *
 * @param {(function|cclib.ColorDefinition|AssetDefinition)} definition
 * @param {string} seedHex
 * @return {Address}
 * @throws {VerifySeedHexError|MultiColorNotSupportedError|VerifyColorDefinitionTypeError}
 */
AddressManager.prototype.getNewAddress = function (definition, seedHex) {
  this.isCurrentSeedCheck(seedHex)

  var chain = selectChain(definition)

  var newIndex = 0
  this.storage.getAll(chain).forEach(function (record) {
    if (record.index >= newIndex) {
      newIndex = record.index + 1
    }
  })

  var publicKey = bitcore.HDPrivateKey.fromSeed(seedHex, this.network)
    .derive("m/0'/" + chain + "'/" + newIndex)
    .privateKey
    .publicKey
    .toString()

  var record = this.storage.add({
    chain: chain,
    index: newIndex,
    pubKey: publicKey
  })

  var assetDefinition
  if (definition instanceof AssetDefinition) {
    assetDefinition = definition
  }

  var address = new Address(this, record, this.network, assetDefinition)
  this.emit('newAddress', address)

  return address
}

/**
 * Get all addresses
 *
 * @param {(function|cclib.ColorDefinition|AssetDefinition)} definition
 * @return {Address[]}
 * @throws {MultiColorNotSupportedError|VerifyColorDefinitionTypeError}
 */
AddressManager.prototype.getAllAddresses = function (definition) {
  var chain = selectChain(definition)

  var assetDefinition
  if (definition instanceof AssetDefinition) {
    assetDefinition = definition
  }

  var self = this
  var addresses = self.storage.getAll(chain).map(function (record) {
    return new Address(self, record, self.network, assetDefinition)
  })

  return addresses
}

/**
 * @param {string} address
 * @return {?bitcore.PublicKey}
 */
AddressManager.prototype.getPubKeyByAddress = function (address) {
  var self = this
  var records = self.storage.getAll().filter(function (record) {
    var recordAddress = new Address(self, record, self.network).getAddress()
    return recordAddress === address
  })

  if (records.length === 0) {
    return null
  }

  return bitcore.PublicKey(records[0].pubKey, this.network)
}

/**
 * @param {string} address
 * @param {string} seedHex
 * @return {?bitcore.Privatekey}
 */
AddressManager.prototype.getPrivKeyByAddress = function (address, seedHex) {
  this.isCurrentSeedCheck(seedHex)

  var self = this
  var records = self.storage.getAll().filter(function (record) {
    var recordAddress = new Address(self, record, self.network).getAddress()
    return recordAddress === address
  })

  if (records.length === 0) {
    return null
  }

  return bitcore.HDPrivateKey.fromSeed(seedHex, this.network)
    .derive('m/' + records[0].account + "'/" + records[0].chain + "'/" + records[0].index)
    .privateKey
}

module.exports = AddressManager
