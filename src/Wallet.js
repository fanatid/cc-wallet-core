var _ = require('lodash')
var Q = require('q')

var address = require('./address')
var asset = require('./asset')
var blockchain = require('./blockchain')
var coin = require('./coin')
var ConfigStorage = require('./ConfigStorage')
var HistoryManager = require('./history').HistoryManager
var network = require('./network')
var tx = require('./tx')

var cclib = require('./cclib')
var bitcoin = require('./bitcoin')
var verify = require('./verify')


/**
 * @callback Wallet~errorCallback
 * @param {?Error} error
 */

/**
 * @class Wallet
 *
 * @param {Object} opts
 * @param {boolean} [opts.testnet=false]
 * @param {string} [opts.network=Electrum]
 * @param {Object} [opts.networkOpts]
 * @param {string} [opts.blockchain=VerifiedBlockchain]
 * @param {number} [opts.storageSaveTimeout=1000] In milliseconds
 */
function Wallet(opts) {
  opts = _.extend({
    testnet: false,
    network: 'Electrum',
    blockchain: 'VerifiedBlockchain',
    storageSaveTimeout: 1000
  }, opts)

  verify.boolean(opts.testnet)
  verify.string(opts.network)
  opts.networkOpts = _.extend({ testnet: opts.testnet }, opts.networkOpts)
  verify.boolean(opts.networkOpts.testnet)
  verify.string(opts.blockchain)
  verify.number(opts.storageSaveTimeout)

  this.bitcoinNetwork = opts.testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin

  this.config = new ConfigStorage()

  this.network = new network[opts.network](this, opts.networkOpts)
  this.blockchain = new blockchain[opts.blockchain](this.network, { testnet: opts.testnet })

  this.cdStorage = new cclib.ColorDefinitionStorage()
  this.cdManager = new cclib.ColorDefinitionManager(this.cdStorage)

  this.cDataStorage = new cclib.ColorDataStorage()
  this.cData = new cclib.ColorData(this.cDataStorage)

  this.aStorage = new address.AddressStorage()
  this.aManager = new address.AddressManager(this.aStorage, this.bitcoinNetwork)

  this.adStorage = new asset.AssetDefinitionStorage()
  this.adManager = new asset.AssetDefinitionManager(this.cdManager, this.adStorage)
  if (opts.systemAssetDefinitions)
    opts.systemAssetDefinitions.forEach(function(sad) {
      this.adManager.resolveAssetDefinition(sad)
    }.bind(this))

  this.txStorage = new tx.TxStorage({saveTimeout: opts.storageSaveTimeout})
  this.txDb = new tx.TxDb(this, this.txStorage)
  this.txFetcher = new tx.TxFetcher(this.txDb, this.blockchain)

  this.coinStorage = new coin.CoinStorage({saveTimeout: opts.storageSaveTimeout})
  this.coinManager = new coin.CoinManager(this, this.coinStorage)

  this.historyManager = new HistoryManager(this)
}

Wallet.prototype.getBitcoinNetwork = function() { return this.bitcoinNetwork }
Wallet.prototype.getBlockchain = function() { return this.blockchain }
Wallet.prototype.getColorDefinitionManager = function() { return this.cdManager }
Wallet.prototype.getColorData = function() { return this.cData }
Wallet.prototype.getAddressManager = function() { return this.aManager }
Wallet.prototype.getAssetDefinitionManager = function() { return this.adManager }
Wallet.prototype.getTxDb = function() { return this.txDb }
Wallet.prototype.getCoinManager = function() { return this.coinManager }
Wallet.prototype.getCoinQuery = function() { return new coin.CoinQuery(this) }

/**
 * @return {boolean}
 */
Wallet.prototype.isInitialized = function() {
  return this.config.get('initialized') || false
}

/**
 * @throws {Error} If not initialized
 */
Wallet.prototype.isInitializedCheck = function() {
  if (!this.isInitialized())
    throw new Error('Wallet not initialized')
}

/**
 * @param {string} seedHex
 * @throws {Error} If already initialized
 */
Wallet.prototype.initialize = function(seedHex) {
  verify.hexString(seedHex)

  if (this.isInitialized())
    throw new Error('Wallet already initialized')

  var addressManager = this.getAddressManager()
  this.getAssetDefinitionManager().getAllAssets().forEach(function(assetdef) {
    if (addressManager.getAllAddresses(assetdef).length === 0)
      addressManager.getNewAddress(assetdef, seedHex)
  })

  this.config.set('initialized', true)
}

/**
 * @param {string} seedHex
 * @throws {Error} If not initialized
 */
Wallet.prototype.isCurrentSeed = function(seedHex) {
  this.isInitializedCheck()
  return this.getAddressManager().isCurrentSeed(seedHex)
}


/**
 * @param {string} seedHex
 * @param {Object} data
 * @param {string[]} data.monikers
 * @param {string[]} data.colorDescs
 * @param {number} [data.unit=1]
 * @return {AssetDefinition}
 * @throws {Error} If asset already exists or not currently seedHex
 */
Wallet.prototype.addAssetDefinition = function(seedHex, data) {
  this.isInitializedCheck()
  this.getAddressManager().isCurrentSeedCheck(seedHex)

  var assetdef = this.getAssetDefinitionManager().resolveAssetDefinition(data)
  if (this.getSomeAddress(assetdef) === null)
    this.getNewAddress(seedHex, assetdef)

  return assetdef
}

/**
 * @param {string} moniker
 * @return {?AssetDefinition}
 * @throws {Error} If not initialized
 */
Wallet.prototype.getAssetDefinitionByMoniker = function(moniker) {
  this.isInitializedCheck()
  return this.getAssetDefinitionManager().getByMoniker(moniker)
}

/**
 * @return {AssetDefinition[]}
 * @throws {Error} If not initialized
 */
Wallet.prototype.getAllAssetDefinitions = function() {
  this.isInitializedCheck()
  return this.getAssetDefinitionManager().getAllAssets()
}

/**
 * Param asColorAddress in address method not good solution
 * But sometimes we need bitcoin address for ColorDefintion,
 *  such as in OperationalTx.getChangeAddress
 */

/**
 * Create new address for given asset
 *
 * @param {string} seedHex
 * @param {AssetDefinition} assetdef
 * @param {boolean} [asColorAddress=false]
 * @return {string}
 * @throws {Error} If wallet not initialized or not currently seedHex
 */
Wallet.prototype.getNewAddress = function(seedHex, assetdef, asColorAddress) {
  this.isInitializedCheck()

  var address = this.getAddressManager().getNewAddress(assetdef, seedHex)

  if (asColorAddress)
    return address.getColorAddress()

  return address.getAddress()
}

/**
 * Return all addresses for given asset
 *
 * @param {AssetDefinition} assetdef
 * @param {boolean} [asColorAddress=false]
 * @return {string[]}
 * @throws {Error} If wallet not initialized
 */
Wallet.prototype.getAllAddresses = function(assetdef, asColorAddress) {
  this.isInitializedCheck()

  var addresses = this.getAddressManager().getAllAddresses(assetdef)

  if (asColorAddress)
    return addresses.map(function(address) { return address.getColorAddress() })

  return addresses.map(function(address) { return address.getAddress() })
}

/**
 * Return first address for given asset or throw Error
 *
 * @param {AssetDefinition} assetdef
 * @param {boolean} [asColorAddress=false]
 * @return {?string}
 * @throws {Error} If wallet not initialized
 */
Wallet.prototype.getSomeAddress = function(assetdef, asColorAddress) {
  this.isInitializedCheck()

  var addresses = this.getAllAddresses(assetdef, asColorAddress)
  if (addresses.length > 0)
    return addresses[0]

  return null
}

/**
 * {@link Address.getBitcoinAddress}
 */
Wallet.prototype.getBitcoinAddress = function(assetdef, colorAddress) {
  return address.Address.getBitcoinAddress(assetdef, colorAddress)
}

/**
 * {@link Address.checkAddress}
 */
Wallet.prototype.checkAddress = function(assetdef, checkedAddress) {
  return address.Address.checkColorAddress(assetdef, checkedAddress)
}

/**
 * @param {Wallet~errorCallback} cb
 */
Wallet.prototype.subscribeAndSyncAddress = function(cb) {
  this.isInitializedCheck()

  this.txFetcher.subscribeAndSyncAddress(address, cb)
}

/**
 * @param {Wallet~errorCallback} cb
 */
Wallet.prototype.subscribeAndSyncAllAddresses = function(cb) {
  this.isInitializedCheck()

  var addresses =_.chain(this.getAllAssetDefinitions())
    .map(function(assetdef) { return this.getAllAddresses(assetdef) }, this)
    .flatten()
    .uniq()
    .value()

  this.txFetcher.subscribeAndSyncAllAddresses(addresses, cb)
}

/**
 * @callback Wallet~getBalance
 * @param {?Error} error
 * @param {Object} balance
 * @param {number} balance.total
 * @param {number} balance.available
 * @param {number} balance.unconfirmed
 */

/**
 * @param {AssetDefinition} assetdef
 * @param {Wallet~getBalance} cb
 * @throws {Error} If wallet not initialized
 */
Wallet.prototype.getBalance = function(assetdef, cb) {
  verify.AssetDefinition(assetdef)
  verify.function(cb)

  var self = this
  self.isInitializedCheck()

  Q.fcall(function() {
    var coinQuery = self.getCoinQuery()
    coinQuery = coinQuery.onlyColoredAs(assetdef.getColorSet().getColorDefinitions())
    coinQuery = coinQuery.onlyAddresses(self.getAllAddresses(assetdef))

    return Q.ninvoke(coinQuery, 'getCoins')

  }).then(function(coinList) {
    return Q.ninvoke(coinList, 'getValues')

  }).then(function(values) {
    var result = {}

    function getValue(name) {
      if (values[name].length > 0)
        result[name] = values[name][0].getValue()
      else
        result[name] = 0
    }

    getValue('total')
    getValue('available')
    getValue('unconfirmed')

    return result

  }).done(function(result) { cb(null, result) }, function(error) { cb(error) })
}

/**
 * @callback Wallet~getBalanceType
 * @param {?Error} error
 * @param {number} balance
 */

/**
 * @param {AssetDefinition} assetdef
 * @param {Wallet~getBalanceType} cb
 * @throws {Error} If wallet not initialized
 */
Wallet.prototype.getTotalBalance = function(assetdef, cb) {
  Q.ninvoke(this, 'getBalance', assetdef)
    .done(function(balance) { cb(null, balance.total) }, function(error) { cb(error) })
}

/**
 * @param {AssetDefinition} assetdef
 * @param {Wallet~getBalanceType} cb
 * @throws {Error} If wallet not initialized
 */
Wallet.prototype.getAvailableBalance = function(assetdef, cb) {
  Q.ninvoke(this, 'getBalance', assetdef)
    .done(function(balance) { cb(null, balance.available) }, function(error) { cb(error) })
}

/**
 * @param {AssetDefinition} assetdef
 * @param {Wallet~getBalanceType} cb
 * @throws {Error} If wallet not initialized
 */
Wallet.prototype.getUnconfirmedBalance = function(assetdef, cb) {
  Q.ninvoke(this, 'getBalance', assetdef)
    .done(function(balance) { cb(null, balance.unconfirmed) }, function(error) { cb(error) })
}

/**
 * @callback Wallet~getHistory
 * @param {?Error} error
 * @param {HistoryEntry[]} history
 */

/**
 * @param {AssetDefinition} [assetdef]
 * @param {Wallet~getHistory} cb
 */
Wallet.prototype.getHistory = function(assetdef, cb) {
  if (_.isUndefined(cb)) {
    cb = assetdef
    assetdef = null
  }

  if (assetdef !== null) verify.AssetDefinition(assetdef)
  verify.function(cb)

  Q.ninvoke(this.historyManager, 'getEntries').then(function(entries) {
    if (assetdef !== null) {
      var assetId = assetdef.getId()
      entries = entries.filter(function(entry) {
        return entry.getTargets().some(function(assetTarget) {
          var targetAssetId = assetTarget.getAsset().getId()
          return targetAssetId === assetId
        })
      })
    }

    return entries

  }).done(function(entries) { cb(null, entries) }, function(error) { cb(error) })
}

/**
 * @typedef {Object} rawTarget
 * @property {number} value Target value in satoshi
 * @property {string} [address] Target address
 */

/**
 * @callback Wallet~createTx
 * @param {?Error} error
 * @param {ComposedTx} tx
 */

/**
 * @param {AssetDefinition} assetdef
 * @param {rawTarget[]} rawTargets
 * @param {Wallet~createTx} cb
 * @throws {Error} If wallet not initialized
 */
Wallet.prototype.createTx = function(assetdef, rawTargets, cb) {
  verify.array(rawTargets)
  verify.function(cb)

  var self = this
  self.isInitializedCheck()

  var assetTargets = rawTargets.map(function(rawTarget) {
    // Todo: add multisig support
    var script = bitcoin.Address.fromBase58Check(rawTarget.address).toOutputScript()
    var assetValue = new asset.AssetValue(assetdef, rawTarget.value)
    return new asset.AssetTarget(script.toHex(), assetValue)
  })

  var assetTx = new tx.AssetTx(self, assetTargets)
  Q.nfcall(tx.transformTx, assetTx, 'composed')
    .done(function(composedTx) { cb(null, composedTx) }, function(error) { cb(error) })
}

/**
 * @callback Wallet~createIssuanceTx
 * @param {?Error} error
 * @param {ComposedTx} tx
 */

/**
 * @param {string} moniker
 * @param {string} pck
 * @param {number} units
 * @param {number} atoms
 * @param {string} seedHex
 * @param {Wallet~createIssuanceTx} cb
 * @throws {Error} If wallet not initialized
 */
Wallet.prototype.createIssuanceTx = function(moniker, pck, units, atoms, seedHex, cb) {
  verify.string(moniker)
  verify.string(pck)
  verify.number(units)
  verify.number(atoms)
  verify.hexString(seedHex)
  verify.function(cb)

  this.isInitializedCheck()

  var self = this

  Q.fcall(function() {
    var colorDefinitionCls = self.getColorDefinitionManager().getColorDefenitionClsForType(pck)
    if (colorDefinitionCls === null)
      throw new Error('color desc ' + pck + ' not recognized')

    var addresses = self.getAddressManager().getAllAddresses(colorDefinitionCls)
    if (addresses.length === 0)
      addresses.push(self.getAddressManager().getNewAddress(colorDefinitionCls, seedHex))

    var targetAddress = addresses[0].getAddress()
    var targetScript = bitcoin.Address.fromBase58Check(targetAddress).toOutputScript()
    var colorValue = new cclib.ColorValue(self.getColorDefinitionManager().getGenesis(), units*atoms)
    var colorTarget = new cclib.ColorTarget(targetScript.toHex(), colorValue)

    var operationalTx = new tx.OperationalTx(self)
    operationalTx.addTarget(colorTarget)

    return Q.nfcall(colorDefinitionCls.composeGenesisTx, operationalTx)

  }).done(function(composedTx) { cb(null, composedTx) }, function(error) { cb(error) })
}

/**
 * @callback Wallet~transformTx
 * @param {?Error} error
 * @param {(RawTx|bitcoinjs-lib.Transaction)} tx
 */

/**
 * @param {(ComposedTx|RawTx)} currentTx
 * @param {string} targetKind
 * @param {string} [seedHex]
 * @param {Wallet~transformTx} cb
 * @throws {Error} If wallet not initialized or not currently seedHex
 */
Wallet.prototype.transformTx = function(currentTx, targetKind, seedHex, cb) {
  if (_.isUndefined(cb)) {
    cb = seedHex
    seedHex = undefined
  }

  verify.function(cb)

  this.isInitializedCheck()

  if (targetKind === 'signed')
    this.getAddressManager().isCurrentSeedCheck(seedHex)

  Q.nfcall(tx.transformTx, currentTx, targetKind, { wallet: this, seedHex: seedHex })
    .done(function(newTx) { cb(null, newTx) }, function(error) { cb(error) })
}

/**
 * @callback Wallet~sendTx
 * @param {?Error} error
 */

/**
 * @param {bitcoinjs-lib.Transaction} tx
 * @param {Wallet~sendTx} cb
 */
Wallet.prototype.sendTx = function(tx, cb) {
  verify.function(cb)

  Q.ninvoke(this.getTxDb(), 'sendTx', tx)
    .done(function() { cb(null) }, function(error) { cb(error) })
}

/**
 */
Wallet.prototype.clearStorage = function() {
  this.config.clear()
  this.blockchain.clear()
  this.cdStorage.clear()
  this.cDataStorage.clear()
  this.aStorage.clear()
  this.adStorage.clear()
  this.coinStorage.clear()
  this.txStorage.clear()
}


module.exports = Wallet
