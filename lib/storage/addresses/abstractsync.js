var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')

var IAddressesStorage = require('./interface')

/**
 * @class AbstractSyncAddressesStorage
 * @extends IAddressesStorage
 */
function AbstractSyncAddressesStorage () {
  var self = this
  IAddressesStorage.call(self)

  self._storage.open()
    .done(function () { self._ready() },
          function (err) { self._ready(err) })
}

inherits(AbstractSyncAddressesStorage, IAddressesStorage)

/**
 * @return {boolean}
 */
AbstractSyncAddressesStorage.isAvailable = function () { return false }

/**
 * @param {IAddressesStorage~Record} data
 * @return {Promise.<IAddressesStorage~Record>}
 */
AbstractSyncAddressesStorage.prototype.add = function (data) {
  var self = this
  return self._storage.transaction(function () {
    var dataKey = data.account + '-' + data.chain
    return self._storage.iterate(function (key, values) {
      values = JSON.parse(values)
      if (key === dataKey && values[data.index] !== undefined) {
        throw new Error('given account, chain and index already used')
      }

      _.each(values, function (pubkey) {
        if (pubkey === data.pubkey) {
          throw new Error('given pubkey already used for other account, chain, index')
        }
      })
    })
    .then(function () {
      return self._storage.get(dataKey)
    })
    .then(function (values) {
      values = values === null ? {} : JSON.parse(values)
      values[data.index] = data.pubkey
      return self._storage.set(dataKey, JSON.stringify(values))
    })
  })
  .then(function () {
    return {
      account: data.account,
      chain: data.chain,
      index: data.index,
      pubkey: data.pubkey
    }
  })
}

/**
 * @param {{account: number, chain: number}} [opts]
 * @return {Promise.<IAddressesStorage~Record[]>}
 */
AbstractSyncAddressesStorage.prototype.get = function (opts) {
  var self = this
  var data = {}
  return self._storage.transaction(function () {
    return Promise.try(function () {
      if (opts !== undefined) {
        var dataKey = opts.account + '-' + opts.chain
        return self._storage.get(dataKey)
          .then(function (values) {
            if (values !== null) {
              data[dataKey] = values
            }
          })
      }

      return self._storage.iterate(function (key, value) {
        data[key] = value
      })
    })
  })
  .then(function () {
    return _.flatten(_.map(data, function (values, key) {
      var account = parseInt(key.split('-')[0], 10)
      var chain = parseInt(key.split('-')[1], 10)
      return _.map(JSON.parse(values), function (pubkey, index) {
        index = parseInt(index, 10)
        return {account: account, chain: chain, index: index, pubkey: pubkey}
      })
    }))
  })
}

/**
 * @return {Promise}
 */
AbstractSyncAddressesStorage.prototype.clear = function () {
  var self = this
  return self._storage.transaction(function () {
    return self._storage.clear()
  })
}

module.exports = AbstractSyncAddressesStorage
