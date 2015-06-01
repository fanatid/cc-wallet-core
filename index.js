var ccwallet = module.exports

// library errors
ccwallet.errors = require('./lib/errors')

//
ccwallet.address = require('./lib/address'),
ccwallet.asset = require('./lib/asset'),
ccwallet.coin = require('./lib/coin'),
ccwallet.history = require('./lib/history'),
ccwallet.tx = require('./lib/tx'),
ccwallet.Wallet = require('./lib/wallet').Wallet,
ccwallet.WalletState = require('./lib/wallet').WalletState,
ccwallet.WalletStateManager = require('./lib/wallet').WalletStateManager

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
