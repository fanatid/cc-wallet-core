var _ = require('lodash')
var inherits = require('util').inherits

var IAssetDefinitionStorage = require('./interface')

var SQL = {
  create: {
    table: 'CREATE TABLE IF NOT EXISTS ccwallet_addresses ( ' +
           '  account INTEGER NOT NULL, ' +
           '  chain INTEGER NOT NULL, ' +
           '  idx INTEGER NOT NULL, ' +
           '  pubkey TEXT PRIMARY KEY)',
    indices: {
      compound: 'CREATE UNIQUE INDEX IF NOT EXISTS ccwallet_addresses_idx ' +
                '  ON ccwallet_addresses (account, chain, idx)'
    }
  },
  insert: {
    row: 'INSERT INTO ccwallet_addresses ' +
         '  (account, chain, idx, pubkey) VALUES ($1, $2, $3, $4)'
  },
  select: {
    all: 'SELECT * FROM ccwallet_addresses',
    byAccountChain: 'SELECT * FROM ccwallet_addresses ' +
                    '  WHERE account = $1 AND chain = $2',
    isUniq: 'SELECT * FROM ccwallet_addresses ' +
              '  WHERE ' +
              '    (account = $1 AND chain = $2 AND idx = $3) OR ' +
              '    pubkey = $4'
  },
  delete: {
    all: 'DELETE FROM ccwallet_addresses'
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
        return self._storage.executeSQL(SQL.create.table)
          .then(function () {
            return self._storage.executeSQL(SQL.create.indices.compound)
          })
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
 * @param {IAddressesStorage~Record} data
 * @return {Promise.<IAddressesStorage~Record>}
 */
AbstractSQLAssetDefinitionStorage.prototype.add = function (data) {
  var self = this
  return self._storage.transaction(function () {
    var args = [data.account, data.chain, data.index, data.pubkey]
    return self._storage.executeSQL(SQL.select.isUniq, args)
      .then(function (rows) {
        if (rows.length === 0) {
          return self._storage.executeSQL(SQL.insert.row, args)
        }

        if (_.find(rows, {pubkey: data.pubkey})) {
          throw new Error('given pubkey already used for other account, chain, index')
        }

        throw new Error('given account, chain and index already used')
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
AbstractSQLAssetDefinitionStorage.prototype.get = function (opts) {
  var self = this
  return self._storage.transaction(function () {
    if (opts === undefined) {
      return self._storage.executeSQL(SQL.select.all)
    }

    var args = [opts.account, opts.chain]
    return self._storage.executeSQL(SQL.select.byAccountChain, args)
  })
  .then(function (rows) {
    return rows.map(function (row) {
      return {
        account: row.account,
        chain: row.chain,
        index: row.idx,
        pubkey: row.pubkey
      }
    })
  })
}

/**
 * @return {Promise}
 */
AbstractSQLAssetDefinitionStorage.prototype.clear = function () {
  var self = this
  return self._storage.transaction(function (tx) {
    return self._storage.executeSQL(SQL.delete.all)
  })
  .then(_.noop)
}

module.exports = AbstractSQLAssetDefinitionStorage
