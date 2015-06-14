'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')

var IAssetDefinitionStorage = require('./interface')

var SQL = {
  create: {
    assets: 'CREATE TABLE IF NOT EXISTS ccwallet_assets ( ' +
            '  pk INTEGER PRIMARY KEY AUTOINCREMENT, ' +
            '  id TEXT NOT NULL UNIQUE, ' +
            '  unit TEXT NOT NULL)',
    monikers: 'CREATE TABLE IF NOT EXISTS ccwallet_assets_monikers ( ' +
              '  moniker TEXT PRIMARY KEY, ' +
              '  asset_id INTEGER NOT NULL, ' +
              '  FOREIGN KEY (asset_id) REFERENCES ccwallet_assets(pk))',
    cdescs: 'CREATE TABLE IF NOT EXISTS ccwallet_assets_cdescs ( ' +
              '  cdesc TEXT PRIMARY KEY, ' +
              '  asset_id INTEGER NOT NULL, ' +
              '  FOREIGN KEY (asset_id) REFERENCES ccwallet_assets(pk))'
  },
  insert: {
    asset: 'INSERT INTO ccwallet_assets ' +
           '  (id, unit) VALUES ($1, $2)',
    moniker: 'INSERT INTO ccwallet_assets_monikers ' +
             '  (moniker, asset_id) VALUES ($1, $2)',
    cdesc: 'INSERT INTO ccwallet_assets_cdescs ' +
           '  (cdesc, asset_id) VALUES ($1, $2)'
  },
  select: {
    assetPK: 'SELECT pk FROM ccwallet_assets WHERE id = $1',
    all: 'SELECT * FROM ccwallet_assets ' +
         '  JOIN ccwallet_assets_monikers ' +
         '    ON ccwallet_assets.pk = ccwallet_assets_monikers.asset_id' +
         '  JOIN ccwallet_assets_cdescs ' +
         '    ON ccwallet_assets.pk = ccwallet_assets_cdescs.asset_id ',
    byId: 'SELECT * FROM ccwallet_assets ' +
          '  JOIN ccwallet_assets_monikers ' +
          '    ON ccwallet_assets.pk = ccwallet_assets_monikers.asset_id ' +
          '  JOIN ccwallet_assets_cdescs ' +
          '    ON ccwallet_assets.pk = ccwallet_assets_cdescs.asset_id' +
          '  WHERE ccwallet_assets.id = $1',
    byMoniker: 'SELECT * FROM ccwallet_assets ' +
               '  JOIN ccwallet_assets_monikers ' +
               '    ON ccwallet_assets.pk = ccwallet_assets_monikers.asset_id ' +
               '  JOIN ccwallet_assets_cdescs ' +
               '    ON ccwallet_assets.pk = ccwallet_assets_cdescs.asset_id ' +
               '  WHERE ccwallet_assets.pk = (SELECT asset_id FROM ccwallet_assets_monikers WHERE moniker = $1)',
    byCdesc: 'SELECT * FROM ccwallet_assets ' +
             '  JOIN ccwallet_assets_monikers ' +
             '    ON ccwallet_assets.pk = ccwallet_assets_monikers.asset_id ' +
             '  JOIN ccwallet_assets_cdescs ' +
             '    ON ccwallet_assets.pk = ccwallet_assets_cdescs.asset_id ' +
             '  WHERE ccwallet_assets.pk = (SELECT asset_id FROM ccwallet_assets_cdescs WHERE cdesc = $1)'
  },
  delete: {
    all: {
      assets: 'DELETE FROM ccwallet_assets',
      monikers: 'DELETE FROM ccwallet_assets_monikers',
      cdescs: 'DELETE FROM ccwallet_assets_cdescs'
    }
  }
}

/**
 * @class AbstractSQLAssetDefinitionStorage
 * @extends IAssetDefinitionStorage
 */
function AbstractSQLAssetDefinitionStorage () {
  var self = this
  IAssetDefinitionStorage.call(self)

  self._storage.open()
    .then(function () {
      return self._storage.transaction(function () {
        return Promise.all([
          self._storage.executeSQL(SQL.create.assets),
          self._storage.executeSQL(SQL.create.monikers),
          self._storage.executeSQL(SQL.create.cdescs)
        ])
      })
    })
    .done(function () { self._ready() },
          function (err) { self._ready(err) })
}

inherits(AbstractSQLAssetDefinitionStorage, IAssetDefinitionStorage)

/**
 * @return {boolean}
 */
AbstractSQLAssetDefinitionStorage.isAvailable = function () { return false }

/**
 * @param {Object[]} rows
 * @return {Object}
 */
AbstractSQLAssetDefinitionStorage.prototype._rows2record = function (rows) {
  return {
    id: rows[0].id,
    monikers: _.uniq(_.pluck(rows, 'moniker')),
    cdescs: _.uniq(_.pluck(rows, 'cdesc')),
    unit: parseInt(rows[0].unit, 10)
  }
}

/**
 * @param {IAssetDefinitionStorage~Record} data
 * @param {Object} [opts]
 * @param {boolean} [opts.autoAdd=true]
 * @return {Promise.<{record: ?IAssetDefinitionStorage~Record, new: ?boolean}>}
 */
AbstractSQLAssetDefinitionStorage.prototype.resolve = function (data, opts) {
  var self = this
  return self._storage.transaction(function () {
    return self._storage.executeSQL(SQL.select.byId, [data.id])
      .then(function (rows) {
        if (rows.length !== 0) {
          return {record: self._rows2record(rows), new: false}
        }

        var autoAdd = Object(opts).autoAdd
        if (!autoAdd && autoAdd !== undefined) {
          return {record: null, new: null}
        }

        var args = [data.id, data.unit.toString(10)]
        return self._storage.executeSQL(SQL.insert.asset, args)
          .then(function () {
            return self._storage.executeSQL(SQL.select.assetPK, [data.id])
          }).then(function (rows) {
            var assetId = rows[0].pk
            return Promise.all([
              Promise.map(data.monikers, function (moniker) {
                args = [moniker, assetId]
                return self._storage.executeSQL(SQL.insert.moniker, args)
              }),
              Promise.map(data.cdescs, function (cdesc) {
                args = [cdesc, assetId]
                return self._storage.executeSQL(SQL.insert.cdesc, args)
              })
            ])
          })
          .then(function () {
            return {
              record: {
                id: data.id,
                monikers: data.monikers.slice(0),
                cdescs: data.cdescs.slice(0),
                unit: data.unit
              },
              new: true
            }
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
AbstractSQLAssetDefinitionStorage.prototype.get = function (opts) {
  var self = this
  return self._storage.transaction(function () {
    var moniker = Object(opts).moniker
    var cdesc = Object(opts).cdesc
    if (moniker !== undefined || cdesc !== undefined) {
      return Promise.try(function () {
        if (moniker === undefined) {
          return self._storage.executeSQL(SQL.select.byCdesc, [cdesc])
        }

        return self._storage.executeSQL(SQL.select.byMoniker, [moniker])
      })
      .then(function (rows) {
        if (rows.length === 0) {
          return null
        }

        return self._rows2record(rows)
      })
    }

    return self._storage.executeSQL(SQL.select.all)
      .then(function (rows) {
        return _.values(_.groupBy(rows, 'id')).map(self._rows2record)
      })
  })
}

/**
 * @return {Promise}
 */
AbstractSQLAssetDefinitionStorage.prototype.clear = function () {
  var self = this
  return self._storage.transaction(function () {
    return Promise.all([
      self._storage.executeSQL(SQL.delete.all.assets),
      self._storage.executeSQL(SQL.delete.all.monikers),
      self._storage.executeSQL(SQL.delete.all.cdescs)
    ])
  })
  .then(_.noop)
}

module.exports = AbstractSQLAssetDefinitionStorage
