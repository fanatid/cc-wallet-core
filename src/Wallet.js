var _ = require('lodash')
var Q = require('q')

var address = require('./address')
var asset = require('./asset')
var blockchain = require('./blockchain')
var coin = require('./coin')
var ConfigStorage = require('./ConfigStorage')
var history = require('./history')
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
 * @param {string} [opts.blockchain=VerifiedBlockchain]
 */
function Wallet(opts) {
  opts = _.extend({
    testnet: false,
    network: 'Electrum',
    blockchain: 'VerifiedBlockchain'
  }, opts)

  verify.boolean(opts.testnet)
  verify.string(opts.network)
  verify.string(opts.blockchain)

  if (opts.network === 'Electrum')
    opts.networkOpts = _.extend({ url: 'ws://devel.hz.udoidio.info:8784/' }, opts.networkOpts)


  this.bitcoinNetwork = opts.testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin

  this.config = new ConfigStorage()

  this.network = new network[opts.network](opts.networkOpts)
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

  this.txStorage = new tx.TxStorage()
  this.txDb = new tx.TxDb(this.txStorage, this.blockchain)
  this.txFetcher = new tx.TxFetcher(this.txDb, this.blockchain)

  this.coinStorage = new coin.CoinStorage()
  this.coinManager = new coin.CoinManager(this, this.coinStorage)

  this.historyManager = new history.HistoryManager(this)
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
 * @param {CoinQuery} coinQuery
 * @param {AssetDefinition} assetdef
 * @param {function} cb
 */
Wallet.prototype._getBalance = function(coinQuery, assetdef, cb) {
  verify.CoinQuery(coinQuery)
  verify.AssetDefinition(assetdef)
  verify.function(cb)

  var self = this

  Q.fcall(function() {
    coinQuery = coinQuery.onlyColoredAs(assetdef.getColorSet().getColorDefinitions())
    coinQuery = coinQuery.onlyAddresses(self.getAllAddresses(assetdef))

    return Q.ninvoke(coinQuery, 'getCoins')

  }).then(function(coinList) {
    return Q.ninvoke(coinList, 'getTotalValue')

  }).then(function(colorValues) {
    if (colorValues.length === 0)
      return 0

    return cclib.ColorValue.sum(colorValues).getValue()

  }).done(function(balance) { cb(null, balance) }, function(error) { cb(error) })
}

/**
 * @param {AssetDefinition} assetdef
 * @param {function} cb
 * @throws {Error} If wallet not initialized
 */
Wallet.prototype.getAvailableBalance = function(assetdef, cb) {
  this.isInitializedCheck()

  var coinQuery = this.getCoinQuery()
  this._getBalance(coinQuery, assetdef, cb)
}

/**
 * @param {AssetDefinition} assetdef
 * @param {function} cb
 * @throws {Error} If wallet not initialized
 */
Wallet.prototype.getTotalBalance = function(assetdef, cb) {
  this.isInitializedCheck()

  var coinQuery = this.getCoinQuery().includeUnconfirmed()
  this._getBalance(coinQuery, assetdef, cb)
}

/**
 * @param {AssetDefinition} assetdef
 * @param {function} cb
 * @throws {Error} If wallet not initialized
 */
Wallet.prototype.getUnconfirmedBalance = function(assetdef, cb) {
  this.isInitializedCheck()

  var coinQuery = this.getCoinQuery().onlyUnconfirmed()
  this._getBalance(coinQuery, assetdef, cb)
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

  var self = this

  Q.ninvoke(self.getBlockchain(), 'sendTx', tx).then(function() {
    var timezoneOffset = new Date().getTimezoneOffset() * 60
    var timestamp = Math.round(Date.now()/1000) + timezoneOffset
    return Q.ninvoke(self.getTxDb(), 'addUnconfirmedTx', tx, { timestamp: timestamp })

  }).done(function() { cb(null) }, function(error) { cb(error) })
}

/**
 * @typedef {Object} rawTarget
 * @property {string} address Target address
 * @property {number} value Target value in satoshi
 */

/**
 * @callback Wallet~sendCoins
 * @param {?Error} error
 * @param {string} txId
 */

/**
 * @param {string} seedHex
 * @param {AssetDefinition} assetdef
 * @param {rawTarget[]} rawTargets
 * @param {Wallet~sendCoins} cb
 * @throws {Error} If wallet not initialized or not currently seedHex
 */
Wallet.prototype.sendCoins = function(seedHex, assetdef, rawTargets, cb) {
  console.warn("Wallet.prototype.sendCoins is deprecated. Use createTx, transformTx and sendTx instead.")

  this.isInitializedCheck()
  this.getAddressManager().isCurrentSeedCheck(seedHex)

  var self = this

  Q.fcall(function() {
    var assetTargets = rawTargets.map(function(target) {
      var script = bitcoin.Address.fromBase58Check(target.address).toOutputScript()
      var assetValue = new asset.AssetValue(assetdef, target.value)
      return new asset.AssetTarget(script.toHex(), assetValue)
    })

    var assetTx = new tx.AssetTx(self)
    assetTx.addTargets(assetTargets)

    return Q.nfcall(tx.transformTx, assetTx, 'signed', { wallet: self, seedHex: seedHex })

  }).then(function(signedTx) {
    return Q.fcall(function() {
      return Q.ninvoke(self.getBlockchain(), 'sendTx', signedTx)

    }).then(function() {
      var timezoneOffset = new Date().getTimezoneOffset() * 60
      var timestamp = Math.round(+new Date()/1000) + timezoneOffset
      return Q.ninvoke(self.getTxDb(), 'addUnconfirmedTx', { tx: signedTx, timestamp: timestamp })

    }).then(function() {
      return signedTx.getId()

    })

  }).done(function(txId) { cb(null, txId) }, function(error) { cb(error) })
}

/**
 * @callback Wallet~issueCoins
 * @param {?Error} error
 */

/**
 * @param {string} seedHex
 * @param {string} moniker
 * @param {string} pck
 * @param {number} units
 * @param {number} atoms
 * @param {Wallet~issueCoins} cb
 * @throws {Error} If wallet not initialized
 */
Wallet.prototype.issueCoins = function(seedHex, moniker, pck, units, atoms, cb) {
  console.warn("Wallet.prototype.issueCoins is deprecated. Use createIssuanceTx, transformTx and sendTx instead.")

  this.isInitializedCheck()
  this.getAddressManager().isCurrentSeedCheck(seedHex)

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

  }).then(function(composedTx) {
    return Q.nfcall(tx.transformTx, composedTx, 'signed', { wallet: self, seedHex: seedHex })

  }).then(function(signedTx) {
    return Q.ninvoke(self.getBlockchain(), 'sendTx', signedTx).then(function() { return signedTx })

  }).then(function(signedTx) {
    return Q.ninvoke(self.getBlockchain(), 'getBlockCount').then(function(blockCount) {
      var colorDesc = [pck, signedTx.getId(), '0', blockCount-1].join(':')

      self.addAssetDefinition(seedHex, {
        monikers: [moniker],
        colorDescs: [colorDesc],
        unit: atoms
      })

      var timezoneOffset = new Date().getTimezoneOffset() * 60
      var timestamp = Math.round(+new Date()/1000) + timezoneOffset
      return Q.ninvoke(self.getTxDb(), 'addUnconfirmedTx', { tx: signedTx, timestamp: timestamp })
    })

  }).done(function() { cb(null) }, function(error) { cb(error) })
}

/**
 * Drop all data from storage's
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
