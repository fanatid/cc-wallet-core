'use strict'

var ccwallet = module.exports

// library errors
ccwallet.errors = require('./lib/errors')

//
ccwallet.addresses = {}
ccwallet.addresses.Address = require('./lib/addresses/address')
ccwallet.addresses.Manager = require('./lib/addresses/manager')

//
ccwallet.assets = {}
ccwallet.assets.AssetDefinition = require('./lib/assets/definition')
ccwallet.assets.AssetManager = require('./lib/assets/manager')
ccwallet.assets.AssetTarget = require('./lib/assets/target')
ccwallet.assets.AssetValue = require('./lib/assets/value')

ccwallet.coin = require('./lib/coin')
ccwallet.history = require('./lib/history')
ccwallet.tx = require('./lib/tx')
ccwallet.Wallet = require('./lib/wallet').Wallet
ccwallet.WalletState = require('./lib/wallet').WalletState
ccwallet.WalletStateManager = require('./lib/wallet').WalletStateManager

// storage
ccwallet.storage = {}
ccwallet.storage.addresses = require('./lib/storage/addresses')
ccwallet.storage.assets = require('./lib/storage/assets')
ccwallet.storage.config = require('./lib/storage/config')
ccwallet.storage.rawtx = require('./lib/storage/rawtx')

// util
ccwallet.util = {}
ccwallet.util.bitcoin = require('./lib/util/bitcoin')
ccwallet.util.const = require('./lib/util/const')
ccwallet.util.enum = require('./lib/util/enum')
ccwallet.util.OrderedMap = require('./lib/util/ordered-map')
ccwallet.util.SyncMixin = require('./lib/util/sync-mixin')
ccwallet.util.tx = require('./lib/util/tx')
