'use strict'

var _ = require('lodash')
var events = require('events')
var inherits = require('util').inherits
var timers = require('timers')
var Promise = require('bluebird')
var makeConcurrent = require('make-concurrent')(Promise)
var bitcore = require('bitcore')
var blockchainjs = require('blockchainjs')
var cclib = require('coloredcoinjs-lib')

var errors = require('./errors')
var Address = require('./addresses/address')
var AddressManager = require('./addresses/manager')
var AssetManager = require('./assets/manager')
var CoinManager = require('./coin/manager')
var CoinQuery = require('./coin/query')
var TxManager = require('./tx/manager')
var SyncMixin = require('./util/sync-mixin')

/**
 * @event Wallet#error
 * @param {Error} error
 */

/**
 * @event Wallet#newBlock
 * @param {string} hash
 * @param {number} height
 */

/**
 * @event Wallet#addTx
 * @param {string} txid
 */

/**
 * @event Wallet#updateTx
 * @param {string} txid
 */

/**
 * @event Wallet#removeTx
 * @param {string} txid
 */

/**
 * @event Wallet#newAddress
 * @param {string} address
 */

/**
 * @event Wallet#newColor
 * @param {string} desc
 */

/**
 * @event Wallet#newAsset
 * @param {string} moniker
 */

/**
 * @event Wallet#touchAddress
 * @param {string} address
 * @param {string} txid
 */

/**
 * @event Wallet#touchAsset
 * @param {string} moniker
 * @param {string} txid
 */

/**
 * @event Wallet#syncStart
 */

/**
 * @event Wallet#syncStop
 */

/**
 * @event Wallet#initialize
 */

/**
 * @class Wallet
 * @extends events.EventEmitter
 * @mixes SyncMixin
 *
 * @param {Object} opts
 * @param {boolean} [opts.testnet=false]
 * @param {Object} [opts.connector]
 * @param {string} [opts.connector.name='Chromanode']
 * @param {Object} [opts.connector.opts]
 * @param {boolean} [opts.connector.autoConnect=true]
 * @param {Object} [opts.blockchain]
 * @param {string} [opts.blockchain.name='Verified']
 * @param {Object} [opts.blockchain.opts]
 * @param {Object} [opts.storage]
 * @param {boolean} [opts.spendUnconfirmedCoins=false] Allow spend unconfirmed coins
 * @param {Object[]} [opts.systemAssetDefinitions]
 */
function Wallet (opts) {
  var self = this
  events.EventEmitter.call(self)

  // global wallet lock
  self.withStateLock = makeConcurrent(function (fn) {
    return fn()
  }, {concurrency: 1})

  // network
  self.networkName = opts.testnet === true ? 'testnet' : 'livenet'
  self.bitcoinNetwork = bitcore.Networks.get(self.networkName)

  // opts for create deps
  opts = _.merge({
    connector: {
      name: 'Chromanode',
      opts: {
        networkName: self.networkName
      },
      autoConnect: true
    },
    blockchain: {
      name: 'Verified',
      opts: {
        networkName: self.networkName,
        testnet: self.networkName === 'testnet',
        compactMode: true,
        chunkHashes: blockchainjs.chunkHashes[self.networkName]
      }
    },
    storage: {
      blockchain: {
        name: 'Memory',
        opts: {
          networkName: self.networkName,
          compactMode: true
        }
      },
      colordefinitions: {
        name: 'Memory'
      },
      colordata: {
        name: 'Memory'
      },
      config: {
        name: 'Memory'
      },
      addresses: {
        name: 'Memory'
      },
      assets: {
        name: 'Memory'
      },
      locktime: {
        name: 'Memory'
      },
      tx: {
        name: 'Memory'
      }
    }
  }, opts)

  // initialize lock
  self._withInitializeLock = makeConcurrent(function (fn) {
    return fn()
  }, {concurrency: 1})

  // addresses lock and cache
  self._withAddressesLock = makeConcurrent(function (fn) {
    return fn()
  }, {concurrency: 1})
  self._allAddressesCache = undefined
  self.on('newAddress', function () { self._allAddressesCache = undefined })

  // can user spend unconfirmed coins?
  self.canSpendUnconfirmedCoins = !!opts.spendUnconfirmedCoins

  // create deps and add listeners
  self._createdeps(opts)
  self._addEventListeners()

  // add default assets
  if (_.isArray(opts.systemAssetDefinitions)) {
    Promise.map(opts.systemAssetDefinitions, function (sad) {
      return self.assetManager.resolveAssetDefinition(sad, {autoAdd: true})
    })
    .done(_.noop, function (err) { self.emit('error', err) })
  }

  // connect if needed
  if (opts.connector.autoConnect) {
    timers.setImmediate(function () { self.connect() })
  }
}

inherits(Wallet, events.EventEmitter)
SyncMixin(Wallet.prototype)

/**
 */
Wallet.prototype._createdeps = function (opts) {
  // connector
  var ConnectorCls = blockchainjs.connector[opts.connector.name]
  this.connector = new ConnectorCls(opts.connector.opts)

  // blockchain
  var BlockchainStorageCls = blockchainjs.storage[opts.storage.blockchain.name]
  this.blockchainStorage = new BlockchainStorageCls(opts.storage.blockchain.opts)

  var BlockchainCls = blockchainjs.blockchain[opts.blockchain.name]
  this.blockchain = new BlockchainCls(opts.blockchain.opts)

  // color definitions
  var ColorDefinitionStorageCls = cclib.storage.definitions[opts.storage.colordefinitions.name]
  this.colorDefinitionStorage = new ColorDefinitionStorageCls(opts.storage.colordefinitions.opts)
  this.colorDefinitionManager = new cclib.definitions.Manager(this.colorDefinitionStorage)

  // color data
  var ColorDataStorageCls = cclib.storage.data[opts.storage.colordata.name]
  this.colorDataStorage = new ColorDataStorageCls(opts.storage.colordata.opts)
  this.colorData = new cclib.ColorData(this.colorDataStorage, this.colorDefinitionManager)

  // config
  var ConfigStorageCls = require('./storage/config')[opts.storage.config.name]
  this.configStorage = new ConfigStorageCls(opts.storage.config.opts)

  // asset definitions
  var AssetsStorageCls = require('./storage/assets')[opts.storage.assets.name]
  this.assetsStorage = new AssetsStorageCls(opts.storage.assets.opts)
  this.assetManager = new AssetManager(this.colorDefinitionManager, this.assetsStorage)

  // addresses
  var AddressesStorageCls = require('./storage/addresses')[opts.storage.addresses.name]
  this.addressesStorage = new AddressesStorageCls(opts.storage.addresses.opts)
  this.addressManager = new AddressManager(this.addressesStorage, this.bitcoinNetwork)

  // coins
  var LockTimeStorageCls = require('./storage/locktime')[opts.storage.locktime.name]
  this.lockTimeStorage = new LockTimeStorageCls(opts.storage.locktime.opts)
  this.coinManager = new CoinManager(this.lockTimeStorage, this)

  // transactions
  var TxStorageCls = require('./storage/tx')[opts.storage.tx.name]
  this.txStorage = new TxStorageCls(opts.storage.tx.opts)
  this.txManager = new TxManager(this.txStorage, this)
}

/**
 */
Wallet.prototype._addEventListeners = function () {
  var self = this

  // connector
  self.connector.on('error', self.emit.bind('error'))

  // blockchain
  self.blockchain.on('error', self.emit.bind('error'))
  self.blockchain.on('newBlock', self.emit.bind('newBlock'))

  // transactions
  self.txManager.on('add', self.emit.bind(self, 'addTx'))
  self.txManager.on('update', self.emit.bind(self, 'updateTx'))
  self.txManager.on('remove', self.emit.bind(self, 'removeTx'))

  // address
  self.addressManager.on('new', function (address) {
    self.emit('newAddress', address.getAddress())
  })
  self.coinManager.on('touchAddress', self.emit.bind(self, 'touchAddress'))

  // color definitions
  self.colorDefinitionManager.on('new', function (cdef) {
    self.emit('newColor', cdef.getDesc())
  })

  // assets
  self.assetManager.on('new', function (adef) {
    self.emit('newAsset', adef.getMonikers()[0])
  })
  self.coinManager.on('touchAsset', self.emit.bind(self, 'touchAsset'))

  // blockchain and state sync events
  _.each([self.blockchain, self.txManager], function (obj) {
    obj.on('error', function (error) {
      console.log('Wallet Error!')
      self.emit('error', error)
    })

    obj.on('syncStart', self._syncEnter.bind(self))
    obj.on('syncStop', self._syncExit.bind(self))
    if (obj.isSyncing()) { self._syncEnter() }
  })
}

/**
 * @param {string} seed
 * @return {Promise}
 */
Wallet.prototype.initialize = function (seed) {
  var self = this
  return self._withInitializeLock(function () {
    return self.configStorage.get('initialized')
      .then(function (isInitialized) {
        isInitialized = !!isInitialized
        if (isInitialized) {
          throw new errors.Wallet.AlreadyInitialized()
        }

        return self.assetManager.get()
      })
      .then(function (adefs) {
        return Promise.map(adefs, function (adef) {
          return self.addressManager.getAllAddresses(adef)
            .then(function (addresses) {
              if (addresses.length === 0) {
                return self.addressManager.getNewAddress(adef, seed)
              }
            })
        })
      })
      .then(function () {
        return self.config.set('initialized', true)
      })
  })
  .then(function () {
    self.emit('initialize')
  })
}

/**
 * @return {Promise.<boolean>}
 */
Wallet.prototype.isInitialized = function () {
  var self = this
  return self._withInitializeLock(function () {
    return self.configStorage.get('initialized')
  })
  .then(function (isInitialized) {
    return !!isInitialized
  })
}

/**
 * @return {Promise}
 */
Wallet.prototype.isInitializedCheck = function () {
  var self = this
  return self.isInitialized()
    .then(function (isInitialized) {
      if (!isInitialized) {
        throw new errors.Wallet.NotInitializedYet()
      }
    })
}

/**
 * @param {string} seed
 * @return {Promise.<boolean>}
 */
Wallet.prototype.isCurrentSeed = function (seed) {
  var self = this
  return self.isInitializedCheck()
    .then(function () {
      return self.addressManager.isCurrentSeed(seed)
    })
}

/**
 * @param {string} seed
 * @param {Object} data
 * @param {string[]} data.monikers
 * @param {string[]} data.colorDescs
 * @param {number} [data.unit]
 * @return {Promise.<AssetDefinition>}
 */
Wallet.prototype.addAssetDefinition = function (seed, data) {
  var self = this
  return self.isCurrentSeed(seed)
    .then(function () {
      return self.assetManager.resolveAssetDefinition(data, {autoAdd: true})
    })
    .then(function (adef) {
      return self.addressManager.getAllAddresses(adef)
        .then(function (addresses) {
          if (addresses.length === 0) {
            return self.addressManager.getNewAddress(seed, adef)
          }
        })
        .then(function () {
          return adef
        })
    })
}

/**
 * @param {string} moniker
 * @return {Promise.<?AssetDefinition>}
 */
Wallet.prototype.getAssetDefinitionByMoniker = function (moniker) {
  var self = this
  return self.isInitializedCheck()
    .then(function () {
      return self.assetManager.get({moniker: moniker})
    })
}

/**
 * @return {Promise.<AssetDefinition[]>}
 */
Wallet.prototype.getAllAssetDefinitions = function () {
  var self = this
  return self.isInitializedCheck()
    .then(function () {
      return self.assetManager.get()
    })
}

/**
 * @param {string} seed
 * @param {(AssetDefinition|ColorDefinition)} xdef
 * @param {boolean} [asColorAddress=false]
 * @return {Promise.<string>}
 */
Wallet.prototype.getNewAddress = function (seed, xdef, asColorAddress) {
  var self = this
  return self._withAddressesLock(function () {
    return self.isInitializedCheck()
      .then(function () {
        return self.addressManager.getNewAddress(seed, xdef)
      })
      .then(function (address) {
        if (asColorAddress) {
          return address.getColorAddress()
        }

        return address.getAddress()
      })
  })
  .finally(function () {
    self._allAddressesCache = undefined
  })
}

/**
 * @param {(AssetDefinition|ColorDefinition)} [xdef]
 * @param {boolean} [asColorAddress=false]
 * @return {Promise.<string[]>}
 */
Wallet.prototype.getAllAddresses = function (xdef, asColorAddress) {
  var self = this
  return self._withAddressesLock(function () {
    return self.isInitializedCheck()
      .then(function () {
        if (self._allAddressesCache !== undefined) {
          return
        }

        var allAddrs = self._allAddressesCache = {colored: {}, uncolored: {}}
        return self.getAllAssetDefinitions()
          .then(function (adefs) {
            return Promise.map(adefs, function (adef) {
              return adef.getColorSet().getColorDefinitions()
            })
          })
          .then(function (cdefs) {
            cdefs = _.uniq(_.flattenDeep(cdefs), function (cdef) {
              return cdef.getColorId()
            })

            return Promise.map(cdefs, function (cdef) {
              return self.addressManager.getAllAddresses(cdef)
                .then(function (addresses) {
                  var id = cdef.getColorId()
                  allAddrs.colored[id] = _.pluck(addresses, 'getColorAddress')
                  allAddrs.uncolored[id] = _.pluck(addresses, 'getAddress')
                })
            })
          })
      })
      .then(function () {
        if (_.isBoolean(xdef) && asColorAddress === undefined) {
          asColorAddress = xdef
          xdef = undefined
        }

        if (xdef === undefined) {
          return []
        }

        if (xdef instanceof cclib.definitions.Interface) {
          return [xdef]
        }

        return xdef.getColorSet().getColorDefinitions()
      })
      .then(function (cdefs) {
        var type = asColorAddress ? 'colored' : 'uncolored'
        var addresses = self._allAddressesCache[type]
        if (cdefs.length > 0) {
          addresses = cdefs.map(function (cdef) {
            return addresses[cdef.getColorId()]
          })
        }

        return _.uniq(_.flatten(addresses))
      })
  })
}

/**
 * @param {(AssetDefinition|ColorDefinition)} xdef
 * @param {boolean} [asColorAddress=false]
 * @return {Promise.<?string>}
 */
Wallet.prototype.getSomeAddress = function (xdef, asColorAddress) {
  var self = this
  return self.isInitializedCheck()
    .then(function () {
      return self.getAllAddresses(xdef, asColorAddress)
    })
    .then(function (addresses) {
      return addresses[0] || null
    })
}

/**
 * @param {string} address
 * @return {string}
 */
Wallet.prototype.getBitcoinAddress = function (address) {
  return Address.getBitcoinAddress(address)
}

/**
 * @param {string} address
 * @param {AssetDefinition} [adef]
 * @return {boolean}
 */
Wallet.prototype.checkAddress = function (address, adef) {
  return Address.checkAddress(address, adef)
}

/**
 * @return {CoinQuery}
 */
Wallet.prototype.getCoinQuery = function () { return new CoinQuery(this) }

/**
 * @typedef Wallet~BalanceObject
 * @property {Object} balance
 * @property {number} balance.total
 * @property {number} balance.available
 * @property {number} balance.unconfirmed
 */

/**
 * @param {AssetDefinition} adef
 * @return {Promise.<Wallet~BalanceObject>}
 */
Wallet.prototype.getBalance = function (adef) {
  var self = this
  return self.isInitializedCheck()
    .then(function () {
      return Promise.all([
        adef.getColorSet().getColorDefinitions(),
        self.getAllAddresses(adef)
      ])
    }).spread(function (cdefs, addresses) {
      return self.getCoinQuery()
        .includeUnconfirmed()
        .includeFrozen()
        .onlyColoredAs(cdefs)
        .onlyAddresses(addresses)
        .getCoins()
    })
    .then(function (coinList) {
      coinList.getValues()
    })
    .then(function (values) {
      return _.chain(['total', 'available', 'unconfirmed'])
        .map(function (name) {
          var value = values[name].length === 0 ? 0 : values[name][0].getValue()
          return [name, value]
        })
        .zipObject()
        .value()
    })
}

/**
 * @param {AssetDefinition} adef
 * @param {Promise.<number>}
 */
Wallet.prototype.getTotalBalance = function (adef) {
  return this.getBalance(adef)
    .then(function (balance) { return balance.total })
}

/**
 * @param {AssetDefinition} adef
 * @param {Promise.<number>}
 */
Wallet.prototype.getAvailableBalance = function (adef) {
  return this.getBalance(adef)
    .then(function (balance) { return balance.available })
}

/**
 * @param {AssetDefinition} adef
 * @param {Promise.<number>}
 */
Wallet.prototype.getUnconfirmedBalance = function (adef) {
  return this.getBalance(adef)
    .then(function (balance) { return balance.unconfirmed })
}

/**
 * @todo
 */
Wallet.prototype.getHistory = function (assetdef) {
  // return this.getStateManager().getHistory(assetdef)
}

/**
 * @param {string} txid
 * @param {Promise.<string}
 */
Wallet.prototype.getTx = function (txid) {
  var self = this
  return self.txManager.getTx(txid)
    .then(function (rawtx) {
      if (rawtx !== null) {
        return rawtx
      }

      return self.blockchain.getTx(txid)
    })
}

/**
 * @return {function}
 */
Wallet.prototype.createGetTxFn = function () {
  var self = this
  return function (txid, cb) {
    return self.getTx(txid)
      .done(function (rawtx) { cb(null, rawtx) },
            function (err) { cb(err) })
  }
}

/**
 * @typedef {Object} rawTarget
 * @property {number} value Target value in satoshi
 * @property {string} address Target address
 */

/**
 * @param {AssetDefinition} adef
 * @param {rawTarget[]} rawTargets
 * @return {Promise<ComposedTx>}
 */
Wallet.prototype.createTx = function (adef, rawTargets) {
  /*
  var self = this
  self.isInitializedCheck()

  var assetTargets = rawTargets.map(function (rawTarget) {
    var script = bitcoin.Address.fromBase58Check(rawTarget.address).toOutputScript()
    var assetValue = new asset.AssetValue(assetdef, rawTarget.value)
    return new asset.AssetTarget(script.toHex(), assetValue)
  })

  var assetTx = new tx.AssetTx(self, assetTargets)
  Q.nfcall(tx.transformTx, assetTx, 'composed').done(
    function (composedTx) { cb(null, composedTx) },
    function (error) { cb(error) }
  )
  */
}

/**
 * @param {string} moniker
 * @param {string} pck
 * @param {number} units
 * @param {number} atoms
 * @param {string} seed
 * @return {Promise.<ComposedTx>}
 */
Wallet.prototype.createIssuanceTx = function (moniker, pck, units, atoms, seed) {
  /*
  this.isInitializedCheck()

  var self = this

  Q.fcall(function () {
    var colorDefinitionCls = cclib.ColorDefinitionManager.getColorDefenitionClsForType(pck)
    if (colorDefinitionCls === null) {
      throw new errors.VerifyColorDefinitionTypeError('Type: ' + pck)
    }

    var addresses = self.getAddressManager().getAllAddresses(colorDefinitionCls)
    if (addresses.length === 0) {
      addresses.push(self.getAddressManager().getNewAddress(colorDefinitionCls, seed))
    }

    var targetAddress = addresses[0].getAddress()
    var targetScript = bitcoin.Address.fromBase58Check(targetAddress).toOutputScript()
    var colorValue = new cclib.ColorValue(cclib.ColorDefinitionManager.getGenesis(), units * atoms)
    var colorTarget = new cclib.ColorTarget(targetScript.toHex(), colorValue)

    var operationalTx = new tx.OperationalTx(self)
    operationalTx.addTarget(colorTarget)

    return Q.nfcall(colorDefinitionCls.composeGenesisTx, operationalTx)

  }).done(function (composedTx) { cb(null, composedTx) }, function (error) { cb(error) })
  */
}

/**
 * @param {(ComposedTx|RawTx)} currentTx
 * @param {string} targetKind
 * @param {Object} [opts]
 * @param {string} [opts.seed]
 * @param {number[]} [opts.signingOnly]
 * @return {Promise.<(RawTx|bitcore.Transaction)>}
 */
Wallet.prototype.transformTx = function (currentTx, targetKind, opts) {
  /*
  if (_.isFunction(opts) && _.isUndefined(cb)) {
    cb = opts
    opts = undefined
  }

  this.isInitializedCheck()
  if (targetKind === 'signed') {
    this.getAddressManager().isCurrentSeedCheck(opts.seed)
  }

  opts = _.extend(opts, {wallet: this})
  Q.nfcall(tx.transformTx, currentTx, targetKind, opts).done(
    function (newTx) { cb(null, newTx) },
    function (error) { cb(error) }
  )
  */
}

/**
 * @param {string} rawtx
 * @return {Promise}
 */
Wallet.prototype.sendTx = function (rawtx) {
  return this.txManager.sendTx(rawtx)
}

/**
 */
Wallet.prototype.connect = function () {
  this.connector.connect()
}

/**
 */
Wallet.prototype.disconnect = function () {
  this.connector.disconnect()
}

/**
 */
Wallet.prototype.removeListeners = function () {
  this.removeAllListeners()
  this.connector.removeAllListeners()
  this.blockchainStorage.removeAllListeners()
  this.blockchain.removeAllListeners()
  this.colorDefinitionManager.removeAllListeners()
  this.assetManager.removeAllListeners()
  this.addressManager.removeAllListeners()
  this.coinManager.removeAllListeners()
  this.txManager.removeAllListeners()
}

/**
 * @return {Promise}
 */
Wallet.prototype.clearStorage = function () {
  return Promise.all([
    this.blockchainStorage.clear(),
    this.colorDefinitionStorage.clear(),
    this.colorDataStorage.clear(),
    this.configStorage.clear(),
    this.assetsStorage.clear(),
    this.addressesStorage.clear(),
    this.lockTimeStorage.clear(),
    this.txManager.clear()
  ])
}

module.exports = Wallet
