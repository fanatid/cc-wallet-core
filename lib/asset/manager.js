/* globals Promise:true */
var events = require('events')
var inherits = require('util').inherits
var timers = require('timers')
var Promise = require('bluebird')
var cclib = require('coloredcoinjs-lib')

var AssetDefinition = require('./definition')

/**
 * @event AssetManager#new
 * @param {AssetDefinition} adef
 */

/**
 * @class AssetManager
 * @extends events.EventEmitter
 * @param {coloredcoinjs-lib.definitions.Manager} cdmanager
 * @param {IAssetDefinitionStorage} storage
 */
function AssetManager (cdmanager, storage) {
  events.EventEmitter.call(this)

  this._cdmanager = cdmanager
  this._storage = storage

  this.resolve({
    monikers: ['bitcoin'],
    cdescs: [cclib.definitions.Manager.getUncolored().getDesc()],
    unit: 100000000
  })
}

inherits(AssetManager, events.EventEmitter)

/**
 * @param {Object} data
 * @param {string[]} data.monikers
 * @param {string[]} data.cdescs
 * @param {number} [data.unit]
 * @param {Object} [opts]
 * @param {boolean} [opts.autoAdd=true]
 * @return {Promise.<AssetDefinition>}
 */
AssetManager.prototype.resolve = function (data, opts) {
  var self = this
  return Promise.try(function () {
    var adef = new AssetDefinition(self._cdmanager, {
      monikers: data.monikers,
      cdescs: data.cdescs,
      unit: data.unit
    })

    return adef.getColorSet().ready
      .then(function () {
        var data = {
          id: adef.getId(),
          monikers: adef.getMonikers(),
          cdescs: adef.getColorSet().getColorDescs(),
          unit: adef.getUnit()
        }
        return self._storage.resolve(data, {autoAdd: Object(opts).autoAdd})
      })
      .then(function (data) {
        if (data.record === null) {
          return null
        }

        if (data.new === true) {
          timers.setImmediate(function () {
            self.emit('new', adef)
          })
        }

        return adef
      })
  })
}

/**
 * @return {Promise.<?>}
 */
AssetManager.prototype.update = function () {}

/**
 * @param {Object} [data]
 * @param {string} [data.moniker]
 * @param {string} [data.cdesc]
 * @return {Promise.<(?AssetDefinition|AssetDefinition[])>}
 */
AssetManager.prototype.get = function (data) {
  var self = this

  var moniker = Object(data).moniker
  var cdesc = Object(data).cdesc
  if (moniker === undefined && cdesc === undefined) {
    return self._storage.get()
      .then(function (records) {
        return records.map(function (record) {
          return new AssetDefinition(self._cdmanager, record)
        })
      })
  }

  return self._storage.get({moniker: moniker, cdesc: cdesc})
    .then(function (record) {
      if (record === null) {
        return null
      }

      return new AssetDefinition(self._cdmanager, record)
    })
}

module.exports = AssetManager
