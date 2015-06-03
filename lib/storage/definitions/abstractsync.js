/* globals Promise:true */
var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')

var IAssetDefinitionStorage = require('./interface')

/**
 * @class AbstractSyncAssetDefinitionStorage
 * @extends IAssetDefinitionStorage
 *
 * @param {Object} provider
 */
function AbstractSyncAssetDefinitionStorage (provider) {
  var self = this
  IAssetDefinitionStorage.call(self)

  self._provider = provider
  self._provider.open()
    .done(function () { self._ready() },
          function (err) { self._ready(err) })
}

inherits(AbstractSyncAssetDefinitionStorage, IAssetDefinitionStorage)

/**
 * @return {boolean}
 */
AbstractSyncAssetDefinitionStorage.isAvailable = function () { return false }

/**
 * @param {IAssetDefinitionStorage~Record} data
 * @param {Object} [opts]
 * @param {boolean} [opts.autoAdd=true]
 * @return {Promise.<{record: ?IAssetDefinitionStorage~Record, new: ?boolean}>}
 */
AbstractSyncAssetDefinitionStorage.prototype.resolve = function (data, opts) {
  var self = this
  return self._provider.transaction(function () {
    return self._provider.get('id-' + data.id)
      .then(function (record) {
        record = JSON.parse(record)
        if (_.isEqual(record, data)) {
          return {record: record, new: false}
        }

        var autoAdd = Object(opts).autoAdd
        if (!autoAdd && autoAdd !== undefined) {
          return {record: null, new: null}
        }

        if (record !== null) {
          throw new Error('already exists')
        }

        return Promise.all([
          Promise.map(data.monikers, function (moniker) {
            return self._provider.get('m-' + moniker)
          }),
          Promise.map(data.cdescs, function (cdesc) {
            return self._provider.get('d-' + cdesc)
          })
        ])
        .spread(function (monikers, cdescs) {
          if (_.any(monikers)) {
            throw new Error('one of monikers is already in use')
          }

          if (_.any(cdescs)) {
            throw new Error('one of cdescs is already in use')
          }

          var record = {
            id: data.id,
            monikers: data.monikers,
            cdescs: data.cdescs,
            unit: data.unit
          }
          return Promise.all([
            self._provider.set('id-' + data.id, JSON.stringify(record)),
            Promise.map(data.monikers, function (moniker) {
              return self._provider.set('m-' + moniker, data.id)
            }),
            Promise.map(data.cdescs, function (cdesc) {
              return self._provider.set('d-' + cdesc, data.id)
            })
          ])
          .then(function () {
            return {record: record, new: true}
          })
        })
      })
  })
}

/**
 * @param {Object} [opts]
 * @param {string} [opts.moniker]
 * @param {string} [opts.cdesc]
 * @return {Promise.<(
 *   ?IAssetDefinitionStorage~Record|
 *   IAssetDefinitionStorage~Record[]
 * )>}
 */
AbstractSyncAssetDefinitionStorage.prototype.get = function (opts) {
  var self = this
  return self._provider.transaction(function () {
    var moniker = Object(opts).moniker
    var cdesc = Object(opts).cdesc
    if (moniker !== undefined || cdesc !== undefined) {
      return Promise.try(function () {
        if (moniker === undefined) {
          return self._provider.get('d-' + cdesc)
        }

        return self._provider.get('m-' + moniker)
      })
      .then(function (id) {
        if (id === null) {
          return null
        }

        return self._provider.get('id-' + id).then(JSON.parse)
      })
    }

    var records = []
    return self._provider.iterate(function (key, value) {
      if (key.slice(0, 3) === 'id-') {
        records.push(JSON.parse(value))
      }
    })
    .then(function () { return records })
  })
}

/**
 * @return {Promise}
 */
AbstractSyncAssetDefinitionStorage.prototype.clear = function () {
  var self = this
  return self._provider.transaction(function () {
    return self._provider.clear()
  })
}

module.exports = AbstractSyncAssetDefinitionStorage
