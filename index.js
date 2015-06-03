var ccwallet = module.exports

// library errors
ccwallet.errors = require('./lib/errors')

//
ccwallet.asset = {}
ccwallet.asset.AssetDefinition = require('./lib/asset/definition')
ccwallet.asset.AssetManager = require('./lib/asset/manager')
ccwallet.asset.AssetTarget = require('./lib/asset/target')
ccwallet.asset.AssetValue = require('./lib/asset/value')

ccwallet.address = require('./lib/address'),
ccwallet.coin = require('./lib/coin'),
ccwallet.history = require('./lib/history'),
ccwallet.tx = require('./lib/tx'),
ccwallet.Wallet = require('./lib/wallet').Wallet,
ccwallet.WalletState = require('./lib/wallet').WalletState,
ccwallet.WalletStateManager = require('./lib/wallet').WalletStateManager

// storage
ccwallet.storage = {}
ccwallet.storage.definitions = require('./lib/storage/definitions')

// util
ccwallet.util = {}
ccwallet.util.bitcoin = require('./lib/util/bitcoin')
ccwallet.util.const = require('./lib/util/const')
ccwallet.util.enum = require('./lib/util/enum')
ccwallet.util.OrderedMap = require('./lib/util/ordered-map')
ccwallet.util.SyncMixin = require('./lib/util/sync-mixin')
ccwallet.util.tx = require('./lib/util/tx')

// dependencies
ccwallet.deps = {}
ccwallet.deps.blockchainjs = require('blockchainjs')
ccwallet.deps.bluebird = require('bluebird')
ccwallet.deps.bs58 = require('bs58')
ccwallet.deps.cclib = require('coloredcoinjs-lib')
ccwallet.deps.lodash = require('lodash')
