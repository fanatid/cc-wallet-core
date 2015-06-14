'use strict'

var _ = require('lodash')
var events = require('events')
var inherits = require('util').inherits
var timers = require('timers')
var Promise = require('bluebird')
var bitcore = require('bitcore')
var cclib = require('coloredcoinjs-lib')

var Address = require('./address')
var AssetDefinition = require('../assets/definition')
var errors = require('../errors')

var UNCOLORED_CHAIN = 0
var EPOBC_CHAIN = 826130763

/**
 * @event AddressManager#new
 * @param {Address} address
 */

/**
 * @class AddressManager
 * @extends events.EventEmitter
 * @param {IAddressStorage} storage
 * @param {Object} [network=bitcore.Networks.livenet]
 */
function AddressManager (storage, network) {
  events.EventEmitter.call(this)

  this._storage = storage
  this._network = network
}

inherits(AddressManager, events.EventEmitter)

/**
 * @private
 * @param {(coloredcoinjs-lib.definitions.Interface|AssetDefinition)} definition
 * @return {Promise.<number>}
 */
AddressManager.prototype._selectChain = function (definition) {
  return Promise.try(function () {
    if (!(definition instanceof AssetDefinition)) {
      return definition
    }

    return definition.getColorSet().getColorDefinitions()
      .then(function (cdefs) {
        if (cdefs.length === 1) {
          return cdefs[0]
        }

        throw new errors.MultiColorNotSupportedError(
          'AddressesManager not support multi-color asset definitions')
      })
  })
  .then(function (definition) {
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
  })
}

/**
 * @param {string} seed
 * @return {Promise.<boolean>}
 */
AddressManager.prototype.isCurrentSeed = function (seed) {
  var self = this
  return self._storage.get({account: 0, chain: UNCOLORED_CHAIN})
    .then(function (records) {
      var zeroPublicKeyRecord = _.find(records, {index: 0})
      if (zeroPublicKeyRecord === undefined) {
        return true
      }

      var rootNode = bitcore.HDPrivateKey.fromSeed(seed, self._network)
      var zeroPublicKey = rootNode.derive('m/0\'/0\'/0').publicKey.toString()
      return zeroPublicKeyRecord.pubkey === zeroPublicKey
    })
}

/**
 * @param {string} seed
 * @return {Promise}
 */
AddressManager.prototype.isCurrentSeedCheck = function (seed) {
  return this.isCurrentSeed(seed)
    .then(function (isCurrentSeed) {
      if (!isCurrentSeed) {
        throw new errors.VerifySeedHexError()
      }
    })
}

/**
 * @param {string} seed
 * @param {(coloredcoinjs-lib.definitions.Interface|AssetDefinition)} definition
 * @return {Promise.<Address>}
 */
AddressManager.prototype.getNewAddress = function (seed, definition) {
  var self = this
  return self.isCurrentSeedCheck(seed)
    .then(function () {
      return self._selectChain(definition)
    })
    .then(function (chain) {
      return self._storage.get({account: 0, chain: chain})
        .then(function (records) {
          var indices = _.pluck(records, 'index')
          var newIndex = indices.length === 0 ? 0 : _.max(indices) + 1

          var path = 'm/0\'/' + chain + '\'/' + newIndex

          var rootNode = bitcore.HDPrivateKey.fromSeed(seed, self._network)
          var publicKey = rootNode.derive(path).publicKey.toString()

          return self._storage.add({
            account: 0,
            chain: chain,
            index: newIndex,
            pubkey: publicKey
          })
          .then(function () {
            var opts = {adef: null, network: self._network}
            if (definition instanceof AssetDefinition) {
              opts.adef = definition
            }

            var address = new Address(publicKey, opts)
            timers.setImmediate(function () {
              self.emit('new', address)
            })

            return address
          })
        })
    })
}

/**
 * @param {(coloredcoinjs-lib.definitions.Interface|AssetDefinition)} definition
 * @return {Promise.<Address[]>}
 */
AddressManager.prototype.getAllAddresses = function (definition) {
  var self = this
  return self._selectChain(definition)
    .then(function (chain) {
      return self._storage.get({account: 0, chain: chain})
    })
    .then(function (records) {
      var opts = {adef: null, network: self._network}
      if (definition instanceof AssetDefinition) {
        opts.adef = definition
      }

      return records.map(function (record) {
        return new Address(record.pubkey, opts)
      })
    })
}

/**
 * @param {string} seed
 * @param {string} address
 * @return {Promise.<?bitcore.PrivateKey>}
 */
AddressManager.prototype.getPrivateKeyByAddress = function (seed, address) {
  var self = this
  return self.isCurrentSeedCheck(seed)
    .then(function () {
      return self._storage.get()
    })
    .then(function (records) {
      var opts = {network: self._network}
      records = records.filter(function (record) {
        var recordAddress = new Address(record.pubkey, opts).getAddress()
        return recordAddress === address
      })

      if (records.length !== 1) {
        return null
      }

      var path = 'm/' + records[0].account + '\'/' + records[0].chain + '\'/' + records[0].index

      var rootNode = bitcore.HDPrivateKey.fromSeed(seed, self._network)
      return rootNode.derive(path).privateKey
    })
}

module.exports = AddressManager
