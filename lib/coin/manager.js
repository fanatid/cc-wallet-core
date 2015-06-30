'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var events = require('events')
var bitcore = require('bitcore')
var cclib = require('coloredcoinjs-lib')
var Promise = require('bluebird')
var makeConcurrent = require('make-concurrent')(Promise)

var Coin = require('../coin/coin')
var bitcoinUtil = require('../util/bitcoin')
var TX_STATUS = require('../util/const').TX_STATUS

var cdefClss = [cclib.definitions.EPOBC]

/**
 * @event CoinManager#touchAddress
 * @param {string} address
 * @param {string} txid
 */

/**
 * @event CoinManager#touchAsset
 * @param {string} moniker
 * @param {string} txid
 */

/**
 * @class CoinManager
 * @extends {event.EventEmitter}
 * @param {Wallet} wallet
 * @param {ILockTimeStorage} storage
 */
function CoinManager (wallet, storage) {
  var self = this
  events.EventEmitter.call(self)

  self._wallet = wallet
  self._storage = storage

  self._coins = []
  self._spend = {}

  self._withLock = makeConcurrent(function (fn) { return fn() })
}

inherits(CoinManager, events.EventEmitter)

/**
 * @param {bitcore.Transaction} tx
 * @return {Promise.<AssetDefinition[]>}
 */
CoinManager.prototype._getAssets = function (tx) {
  var self = this
  var getTxFn = self._wallet.createGetTxFn()
  return Promise.map(cdefClss, function (cdefCls) {
    return self._wallet.colorData.getTxColorValues(
      tx, null, cdefCls, getTxFn)
  })
  .then(function (aColorValues) {
    var cdescs = _.chain(aColorValues)
      .pluck('outputs')
      .flatten()
      .map(function (colorValue) {
        return colorValue.getColorDefinition().getDesc()
      })
      .uniq()
      .value()

    return Promise.map(cdescs, function (cdesc) {
      return self._wallet.assetManager.get({cdesc: cdesc})
    })
  })
  .then(function (adefs) {
    return _.uniq(_.filter(adefs), function (adef) { return adef.getId() })
  })
}

/**
 * @param {bitcore.Transaction} tx
 * @param {function} emit
 * @return {Promise}
 */
CoinManager.prototype._addTx = function (tx, emit) {
  var self = this
  return self._withLock(function () {
    var txid = tx.id

    tx.inputs.forEach(function (input) {
      var txid = input.prevTxId.toString('hex')
      self._spend = _.union(self._spend[txid], input.outputIndex)
    })

    return self._wallet.getAllAddresses()
      .then(function (walletAddresses) {
        // add coins and generate touchAddress
        var network = self._wallet.bitcoinNetwork
        return Promise.map(tx.outputs, function (output, oidx) {
          var touchedAddresses = _.intersection(
            bitcoinUtil.script2addresses(output.script, network),
            walletAddresses)

          if (touchedAddresses.length === 0) {
            return
          }

          return self._storage.get(txid, oidx)
            .then(function (lockTime) {
              self._coins.push({
                txid: txid,
                oidx: oidx,
                value: output.satoshis,
                script: output.script.toString('hex'),
                addresses: touchedAddresses,
                lockTime: lockTime
              })
              return touchedAddresses
            })
        })
        .then(function (touched) {
          _.uniq(_.flatten(touched)).forEach(function (address) {
            emit('touchAddress', address, txid)
          })
        })
      })
      .then(function () {
        // calculate color values and generate touchAsset
        return self._getAssets()
      })
      .then(function (adefs) {
        adefs.forEach(function (adef) {
          emit('touchAsset', adef, txid)
        })
      })
  })
}

/**
 * @param {bitcore.Transaction} tx
 * @return {Promise}
 */
CoinManager.prototype.loadTx = function (tx) {
  return this._addTx(tx, _.noop)
}

/**
 * @param {bitcore.Transaction} tx
 * @return {Promise}
 */
CoinManager.prototype.addTx = function (tx) {
  return this._addTx(tx, this.emit.bind(this))
}

/**
 * @param {bitcore.Transaction} tx
 * @return {Promise}
 */
CoinManager.prototype.removeTx = function (tx) {
  var self = this
  return self._withLock(function () {
    var txid = tx.id

    tx.inputs.forEach(function (input) {
      var txid = input.prevTxId.toString('hex')
      self._spend[txid] = _.without(self._spend[txid], input.index)
      if (self._spend[txid].length === 0) {
        delete self._spend[txid]
      }
    })

    return self._wallet.getAllAddresses()
      .then(function (walletAddresses) {
        var removedCoins = _.filter(self._coins, {txid: txid})
        return Promise.map(removedCoins, function (coin) {
          return self._storage.remove(coin.txid, coin.oidx)
        })
        .then(function () {
          self._coins = _.reject(self._coins, {txid: txid})

          _.chain(removedCoins)
            .pluck('addresses')
            .flatten()
            .uniq()
            .intersection()
            .forEach(function (address) {
              self.emit('touchAddress', address, txid)
            })

          return self._getAssets(tx)
        })
      })
      .then(function (adefs) {
        adefs.forEach(function (adef) {
          self.emit('touchAsset', adef, txid)
        })
      })
  })
}

/**
 * @param {Coin~RawCoin[]} coins
 * @param {?number} lockTime
 * @return {Promise}
 */
CoinManager.prototype._changeLockTime = function (coins, lockTime) {
  var self = this
  return self._withLock(function () {
    if (!_.isArray(coins)) {
      coins = [coins]
    }

    // first, find all coins
    var records = coins.map(function (coin) {
      var row = _.find(self._coins, {txid: coin.txid, oidx: coin.oidx})
      if (row === undefined) {
        throw new Error('Coin not found: ' + coin.txid + ':' + coin.oidx)
      }

      return row
    })

    // set lockTime in storage and after in record
    return Promise.map(records, function (record) {
      return Promise.try(function () {
        if (lockTime === null) {
          return self._storage.remove(record.txid, record.oidx)
        }

        return self._storage.set(record.txid, record.oidx, lockTime)
      })
      .then(function () {
        record.lockTime = lockTime
      })
    })
  })
}

/**
 * @param {Coin~RawCoin[]} coins
 * @param {Object} opts Freeze options
 * @param {number} [opts.height] Until height is not be reached
 * @param {number} [opts.timestamp] Until timestamp not be reached (in seconds)
 * @param {number} [opts.fromNow] Freeze for given number in seconds
 * @return {Promise}
 */
CoinManager.prototype.freezeCoins = function (coins, opts) {
  var lockTime = opts.height ||
                 opts.timestamp ||
                 opts.fromNow + Math.round(Date.now() / 1000)

  if (lockTime < 0) {
    throw new Error('lockTime must be greater than or equal zero')
  }

  return this._changeLockTime(coins, lockTime)
}

/**
 * @param {Coin~RawCoin[]} coins
 * @return {Promise}
 */
CoinManager.prototype.unfreezeCoins = function (coins) {
  return this._changeLockTime(coins, null)
}

/**
 * @param {Coin~RawCoin[]} coin
 * @return {Promise.<boolean>}
 */
CoinManager.prototype.isCoinValid = function (coin) {
  return this._wallet.txManager.getTxInfo(coin.txid)
    .then(function (txInfo) {
      if (txInfo == null ||
          bitcore.Transaction(txInfo.rawtx).outputs.length <= coin.odx) {
        throw new Error('Coin not found ' + coin.txid + ':' + coin.oidx)
      }

      return TX_STATUS.isValid(txInfo.status)
    })
}

/**
 * @param {Coin~RawCoin[]} coin
 * @return {Promise.<boolean>}
 */
CoinManager.prototype.isCoinAvailable = function (coin) {
  return this._wallet.txManager.getTxInfo(coin.txid)
    .then(function (txInfo) {
      if (txInfo == null ||
          bitcore.Transaction(txInfo.rawtx).outputs.length <= coin.odx) {
        throw new Error('Coin not found ' + coin.txid + ':' + coin.oidx)
      }

      return TX_STATUS.isAvailable(txInfo.status)
    })
}

/**
 * @param {Coin~RawCoin[]} coin
 * @return {boolean}
 */
CoinManager.prototype._isCoinSpent = function (coin) {
  var oidxs = this._spend[coin.txid] || []
  return oidxs.indexOf(coin.oidx) !== -1
}

/**
 * @param {Coin~RawCoin[]} coin
 * @return {Promise.<boolean>}
 */
CoinManager.prototype.isCoinSpent = function (coin) {
  var self = this
  return self._withLock(function () {
    return self._isCoinSpent(coin)
  })
}

/**
 * @param {Coin~RawCoin[]} coin
 * @return {boolean}
 */
CoinManager.prototype._isCoinFrozen = function (coin) {
  var record = _.find(this._coins, {txid: coin.txid, oidx: coin.oidx})
  if (coin === undefined) {
    throw new Error('Coin not found ' + coin.txid + ':' + coin.oidx)
  }

  if (record.lockTime === null) {
    return false
  }

  if (record.lockTime < 500000000) {
    var currentHeight = this._wallet.blockchain.latest.height
    return record.lockTime > currentHeight
  }

  var currentTimestamp = Math.round(Date.now() / 1000)
  return record.lockTime > currentTimestamp
}

/**
 * @param {Coin~RawCoin[]} coin
 * @return {Promise.<boolean>}
 */
CoinManager.prototype.isCoinFrozen = function (coin) {
  var self = this
  return self._withLock(function () {
    return self._isCoinFrozen(coin)
  })
}

/**
 * @param {Coin~RawCoin[]} coin
 * @return {ColorValue}
 */
CoinManager.prototype.getCoinColorValue = function (coin) {
  var self = this
  var getTxFn = self._wallet.createGetTxFn()
  return Promise.try(function () {
    if (coin.tx !== undefined) {
      return coin.tx
    }

    return self._wallet.getTx(coin.txid)
      .then(function (rawtx) {
        return bitcore.Transaction(rawtx)
      })
  })
  .then(function (tx) {
    return Promise.map(cdefClss, function (cdefCls) {
      return self._wallet.colorData.getOutputColorValue(
        tx, coin.oidx, cdefCls, getTxFn)
    })
  })
  .then(function (aColorValues) {
    var colorValues = _.filter(_.flatten(aColorValues))
    if (colorValues.length > 1) {
      throw new Error('Coin ' + coin.txid + ':' + coin.oidx + ' have more than one color values')
    }

    var colorValue = colorValues[0]
    if (colorValue === undefined) {
      colorValue = new cclib.ColorValue(
        cclib.definitions.Manager.getUncolored(), coin.value)
    }

    return colorValue
  })
}

/**
 * @typedef CoinManager~CoinsColorValues
 * @property {ColorValue[]} total
 * @property {ColorValue[]} available
 * @property {ColorValue[]} unconfirmed
 */

/**
 * @param {Coin~RawCoin[]} coins
 * @return {CoinManager~CoinsColorValues[]}
 */
CoinManager.prototype.getCoinsColorValues = function (coins) {
  var self = this
  var values = {total: {}, available: {}, unconfirmed: {}}
  return Promise.map(coins, function (coin) {
    return Promise.all([
      self.getCoinColorValues(coin),
      self.isCoinAvailable(coin)
    ])
    .spread(function (colorValue, isCoinAvailable) {
      var cid = colorValue.getColorId()
      if (values.total[cid] === undefined) {
        var zeroColorValue = new cclib.ColorValue(
          colorValue.getColorDefinition(), 0)
        values.total = zeroColorValue
        values.available = zeroColorValue
        values.unconfirmed = zeroColorValue
      }

      values.total[cid] = values.total[cid].plus(colorValue)
      if (isCoinAvailable) {
        values.available[cid] = values.available[cid].plus(colorValue)
      } else {
        values.unconfirmed[cid] = values.unconfirmed[cid].plus(colorValue)
      }
    })
  })
  .then(function () {
    return {
      total: _.values(values.total),
      available: _.values(values.available),
      unconfirmed: _.values(values.unconfirmed)
    }
  })
}

/**
 * @param {CoinQuery~RawQuery} query
 * @return {Coin[]}
 */
CoinManager.prototype.getCoins = function (query) {
  var self = this
  return self._withLock(function () {
    function SkipCoin () { Error.call(this) }
    inherits(SkipCoin, Error)

    return Promise.map(self._coins, function (coin) {
      return Promise.try(function () {
        if (query.onlyAddresses !== null) {
          var intxn = _.intersection(coin.addresses, query.onlyAddresses)
          if (intxn.length === 0) {
            throw new SkipCoin()
          }
        }

        return self.isCoinValid(coin)
      })
      .then(function (isCoinValid) {
        if (!isCoinValid) {
          throw new SkipCoin()
        }

        return self.isCoinAvailable(coin)
      })
      .then(function (isCoinAvailable) {
        if ((query.onlyUnconfirmed && isCoinAvailable) ||
            (!query.onlyUnconfirmed && !query.includeUnconfirmed && !isCoinAvailable)) {
          throw new SkipCoin()
        }

        return self._isCoinSpent(coin)
      })
      .then(function (isCoinSpent) {
        if ((query.onlySpent && !isCoinSpent) ||
            (!query.onlySpent && !query.includeSpent && isCoinSpent)) {
          throw new SkipCoin()
        }

        return self._isCoinFrozen(coin)
      })
      .then(function (isCoinFrozen) {
        if ((query.onlyFrozen && !isCoinFrozen) ||
            (!query.onlyFrozen && !query.includeFrozen && isCoinFrozen)) {
          throw new SkipCoin()
        }

        if (query.onlyColoredAs === null) {
          return coin
        }

        return self.getCoinColorValue(coin)
          .then(function (colorValue) {
            if (query.onlyColoredAs.indexOf(colorValue.getColorId()) !== -1) {
              return coin
            }
          })
      })
      .catch(SkipCoin, _.noop)
    })
  })
  .then(function (records) {
    return _.filter(records).map(function (record) {
      return new Coin(record, self)
    })
  })
}

module.exports = CoinManager
