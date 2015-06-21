'use strict'

var ccwallet = module.exports = require('./lib/wallet/wallet')

// library errors
ccwallet.errors = require('./lib/errors')

//
ccwallet._addresses = {}
ccwallet._addresses.Address = require('./lib/addresses/address')
ccwallet._addresses.Manager = require('./lib/addresses/manager')

//
ccwallet._assets = {}
ccwallet._assets.AssetDefinition = require('./lib/assets/definition')
ccwallet._assets.AssetManager = require('./lib/assets/manager')
ccwallet._assets.AssetTarget = require('./lib/assets/target')
ccwallet._assets.AssetValue = require('./lib/assets/value')

//
// ccwallet.coin = require('./lib/coin')
// ccwallet.history = require('./lib/history')
// ccwallet.tx = require('./lib/tx')
// ccwallet.WalletState = require('./lib/wallet/state')
// ccwallet.WalletStateManager = require('./lib/wallet/statemanager')

// storage
ccwallet._storage = {}
ccwallet._storage.addresses = require('./lib/storage/addresses')
ccwallet._storage.assets = require('./lib/storage/assets')
ccwallet._storage.config = require('./lib/storage/config')
ccwallet._storage.rawtx = require('./lib/storage/rawtx')

// util
ccwallet._util = {}
ccwallet._util.bitcoin = require('./lib/util/bitcoin')
ccwallet._util.const = require('./lib/util/const')
ccwallet._util.enum = require('./lib/util/enum')
ccwallet._util.OrderedMap = require('./lib/util/ordered-map')
ccwallet._util.SyncMixin = require('./lib/util/sync-mixin')
ccwallet._util.tx = require('./lib/util/tx')
