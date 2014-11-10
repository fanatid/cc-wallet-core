var _ = require('lodash')

var cclib = require('../cclib')
var bitcoin = require('../bitcoin')
var ECPubKey = bitcoin.ECPubKey
var HDNode = bitcoin.HDNode

var Address = require('./Address')
var AssetDefinition = require('../asset').AssetDefinition
var verify = require('../verify')

var UNCOLORED_CHAIN = 0
var EPOBC_CHAIN = 826130763


/**
 * @param {bitcoinjs-lib.HDNode} rootNode
 * @param {number} account
 * @param {number} chain
 * @param {number} index
 * @return {bitcoinjs-lib.HDNode}
 */
function derive(rootNode, account, chain, index) {
  verify.HDNode(rootNode)
  verify.number(account)
  verify.number(chain)
  verify.number(index)

  var node = rootNode
  var path = account + '\'/' + chain + '\'/' + index

  path.split('/').forEach(function(value) {
    var usePrivate = (value.length > 1) && (value[value.length - 1] === '\'')
    var childIndex = parseInt(usePrivate ? value.slice(0, value.length - 1) : value) & 0x7fffffff

    if (usePrivate)
      childIndex += 0x80000000

    node = node.derive(childIndex)
  })

  return node
}

/**
 * @param {(function|ColorDefinition|AssetDefinition)} definition
 * @return {number}
 * @throws {Error} If multi-color asset or unknown definition type
 */
function selectChain(definition) {
  if (definition instanceof AssetDefinition) {
    var colordefs = definition.getColorSet().getColorDefinitions()
    if (colordefs.length !== 1)
      throw new Error('Currently only single-color assets are supported')

    definition = colordefs[0]
  }

  if (definition instanceof cclib.ColorDefinition)
    definition = definition.constructor

  switch (definition) {
    case cclib.UncoloredColorDefinition:
      return UNCOLORED_CHAIN

    case cclib.EPOBCColorDefinition:
      return EPOBC_CHAIN

    default:
      throw new Error('Unknow ColorDefinition')
  }
}


/**
 * @class AddressManager
 *
 * @param {storage.AddressStorage} storage
 * @param {Object} network Network description from bitcoinjs-lib.networks
 */
function AddressManager(storage, network) {
  verify.AddressStorage(storage)
  verify.bitcoinNetwork(network)

  this.storage = storage
  this.network = network
}

/**
 * @param {string} seedHex
 * @return {bitcoinjs-lib.HDNode}
 */
AddressManager.prototype.HDNodeFromSeed = function(seedHex) {
  verify.hexString(seedHex)
  return HDNode.fromSeedHex(seedHex, this.network)
}

/**
 * @param {string} seedHex
 * @return {boolean}
 */
AddressManager.prototype.isCurrentSeed = function(seedHex) {
  var oldZeroPubKeys = _.sortBy(this.storage.getAll(UNCOLORED_CHAIN), 'index')
  if (oldZeroPubKeys.length === 0)
    return this.storage.getAll().length === 0

  var rootNode = this.HDNodeFromSeed(seedHex)
  var newZeroPubKey = derive(rootNode, 0, UNCOLORED_CHAIN, 0).pubKey.toHex()

  return oldZeroPubKeys[0].pubKey === newZeroPubKey
}

/**
 * @param {string} seedHex
 * @throws {Error} If not currently seedHex
 */
AddressManager.prototype.isCurrentSeedCheck = function(seedHex) {
  if (!this.isCurrentSeed(seedHex))
    throw new Error('Given seedHex is not currently used')
}

/**
 * Get new address and save it to db
 *
 * @param {(function|ColorDefinition|AssetDefinition)} definition
 * @param {string} seedHex
 * @return {Address}
 * @throws {Error} If not currently seedHex or unknow chain
 */
AddressManager.prototype.getNewAddress = function(definition, seedHex) {
  this.isCurrentSeedCheck(seedHex)

  var chain = selectChain(definition)

  var newIndex = 0
  this.storage.getAll(chain).forEach(function(record) {
    if (record.index >= newIndex)
      newIndex = record.index + 1
  })

  var rootNode = this.HDNodeFromSeed(seedHex)
  var pubKey = derive(rootNode, 0, chain, newIndex).pubKey

  var record = this.storage.add({
    chain: chain,
    index: newIndex,
    pubKey: pubKey.toHex()
  })

  var assetDefinition
  if (definition instanceof AssetDefinition)
    assetDefinition = definition

  return new Address(this, record, this.network, assetDefinition)
}

/**
 * Get all addresses
 *
 * @param {(function|ColorDefinition|AssetDefinition)} definition
 * @return {Address[]}
 * @throws {Error} If unknow chain
 */
AddressManager.prototype.getAllAddresses = function(definition) {
  var chain = selectChain(definition)

  var assetDefinition
  if (definition instanceof AssetDefinition)
    assetDefinition = definition

  var addresses = this.storage.getAll(chain).map(function(record) {
    return new Address(this, record, this.network, assetDefinition)
  }.bind(this))

  return addresses
}

/**
 * @param {string} address
 * @return {?bitcoinjs-lib.ECPubKey}
 */
AddressManager.prototype.getPubKeyByAddress = function(address) {
  verify.string(address)

  var records = this.storage.getAll().filter(function(record) {
    var recordAddress = new Address(this, record, this.network).getAddress()
    return recordAddress === address
  }.bind(this))

  if (records.length === 0)
    return null

  return ECPubKey.fromHex(records[0].pubKey)
}

/**
 * @param {string} address
 * @param {string} seedHex
 * @return {?bitcoinjs-lib.ECKey}
 */
AddressManager.prototype.getPrivKeyByAddress = function(address, seedHex) {
  verify.string(address)
  this.isCurrentSeedCheck(seedHex)

  var records = this.storage.getAll().filter(function(record) {
    var recordAddress = new Address(this, record, this.network).getAddress()
    return recordAddress === address
  }.bind(this))

  if (records.length === 0)
    return null

  var rootNode = this.HDNodeFromSeed(seedHex)
  var node = derive(rootNode, records[0].account, records[0].chain, records[0].index)
  return node.privKey
}


module.exports = AddressManager
