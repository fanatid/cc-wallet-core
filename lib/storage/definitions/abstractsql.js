/* globals Promise:true */
var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')

var IAssetDefinitionStorage = require('./interface')

var SQL = {
  create: {
    assets: 'CREATE TABLE IF NOT EXISTS asset_definitions ( ' +
            '  pk INTEGER PRIMARY KEY AUTOINCREMENT, ' +
            '  id TEXT NOT NULL UNIQUE, ' +
            '  unit TEXT NOT NULL)',
    monikers: 'CREATE TABLE IF NOT EXISTS asset_definitions_monikers ( ' +
              '  moniker TEXT PRIMARY KEY, ' +
              '  asset_id INTEGER NOT NULL, ' +
              '  FOREIGN KEY (asset_id) REFERENCES asset_definitions(pk))',
    cdescs: 'CREATE TABLE IF NOT EXISTS asset_definitions_cdescs ( ' +
              '  cdesc TEXT PRIMARY KEY, ' +
              '  asset_id INTEGER NOT NULL, ' +
              '  FOREIGN KEY (asset_id) REFERENCES asset_definitions(pk))'
  },
  insert: {
    asset: 'INSERT INTO asset_definitions ' +
           '  (id, unit) VALUES ($1, $2)',
    moniker: 'INSERT INTO asset_definitions_monikers ' +
             '  (moniker, asset_id) VALUES ($1, $2)',
    cdesc: 'INSERT INTO asset_definitions_cdescs ' +
           '  (cdesc, asset_id) VALUES ($1, $2)'
  },
  select: {
    lastAsset: 'SELECT pk FROM asset_definitions ORDER BY pk DESC LIMIT 1',
    all: 'SELECT * FROM asset_definitions ' +
         '  JOIN asset_definitions_monikers ' +
         '    ON asset_definitions.pk = asset_definitions_monikers.asset_id' +
         '  JOIN asset_definitions_cdescs ' +
         '    ON asset_definitions.pk = asset_definitions_cdescs.asset_id',
    byId: 'SELECT * FROM asset_definitions ' +
          '  JOIN asset_definitions_monikers ' +
          '    ON asset_definitions.pk = asset_definitions_monikers.asset_id' +
          '  JOIN asset_definitions_cdescs ' +
          '    ON asset_definitions.pk = asset_definitions_cdescs.asset_id' +
          '  WHERE asset_definitions.id = $1',
    byMoniker: 'SELECT * FROM asset_definitions ' +
               '  JOIN asset_definitions_monikers ' +
               '    ON asset_definitions.pk = asset_definitions_monikers.asset_id' +
               '  JOIN asset_definitions_cdescs ' +
               '    ON asset_definitions.pk = asset_definitions_cdescs.asset_id' +
               '  WHERE asset_definitions.pk = (SELECT asset_id FROM asset_definitions_monikers WHERE moniker = $1)',
    byCdesc: 'SELECT * FROM asset_definitions ' +
             '  JOIN asset_definitions_monikers ' +
             '    ON asset_definitions.pk = asset_definitions_monikers.asset_id' +
             '  JOIN asset_definitions_cdescs ' +
             '    ON asset_definitions.pk = asset_definitions_cdescs.asset_id' +
             '  WHERE asset_definitions.pk = (SELECT asset_id FROM asset_definitions_cdescs WHERE cdesc = $1)'
  },
  delete: {
    all: {
      assets: 'DELETE FROM asset_definitions',
      monikers: 'DELETE FROM asset_definitions_monikers',
      cdescs: 'DELETE FROM asset_definitions_cdescs'
    }
  }
}

/**
 * @class AbstractSQLAssetDefinitionStorage
 * @extends IAssetDefinitionStorage
 * @param {Object} provider
 */
function AbstractSQLAssetDefinitionStorage (provider) {
  var self = this
  IAssetDefinitionStorage.call(self)

  self._provider = provider
  self._provider.open()
    .then(function () {
      return self._provider.transaction(function (tx) {
        return Promise.all([
          tx.execute(SQL.create.assets),
          tx.execute(SQL.create.monikers),
          tx.execute(SQL.create.cdescs)
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
  return self._provider.transaction(function (tx) {
    return tx.execute(SQL.select.byId, [data.id])
      .then(function (rows) {
        if (rows.length !== 0) {
          return {record: self._rows2record(rows), new: false}
        }

        var autoAdd = Object(opts).autoAdd
        if (!autoAdd && autoAdd !== undefined) {
          return {record: null, new: null}
        }

        return tx.execute(SQL.insert.asset, [data.id, data.unit.toString(10)])
          .then(function () {
            return tx.execute(SQL.select.lastAsset)
          }).then(function (rows) {
            var assetId = rows[0].pk
            return Promise.all([
              Promise.map(data.monikers, function (moniker) {
                return tx.execute(SQL.insert.moniker, [moniker, assetId])
              }),
              Promise.map(data.cdescs, function (cdesc) {
                return tx.execute(SQL.insert.cdesc, [cdesc, assetId])
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
  return self._provider.transaction(function (tx) {
    var moniker = Object(opts).moniker
    var cdesc = Object(opts).cdesc
    if (moniker !== undefined || cdesc !== undefined) {
      return Promise.try(function () {
        if (moniker === undefined) {
          return tx.execute(SQL.select.byCdesc, [cdesc])
        }

        return tx.execute(SQL.select.byMoniker, [moniker])
      })
      .then(function (rows) {
        if (rows.length === 0) {
          return null
        }

        return self._rows2record(rows)
      })
    }

    return tx.execute(SQL.select.all)
      .then(function (rows) {
        return _.values(_.groupBy(rows, 'id')).map(self._rows2record)
      })
  })
}

/**
 * @return {Promise}
 */
AbstractSQLAssetDefinitionStorage.prototype.clear = function () {
  return this._provider.transaction(function (tx) {
    return Promise.all([
      tx.execute(SQL.delete.all.assets),
      tx.execute(SQL.delete.all.monikers),
      tx.execute(SQL.delete.all.cdescs)
    ])
  })
  .then(function () {})
}

module.exports = AbstractSQLAssetDefinitionStorage
