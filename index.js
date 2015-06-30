'use strict'

var ccwallet = module.exports = require('./lib/wallet')

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

//
ccwallet.coin = {}
ccwallet.coin.manager = require('./lib/coin/manager')

// storage
ccwallet.storage = {}
ccwallet.storage.addresses = require('./lib/storage/addresses')
ccwallet.storage.assets = require('./lib/storage/assets')
ccwallet.storage.config = require('./lib/storage/config')
ccwallet.storage.locktime = require('./lib/storage/locktime')
ccwallet.storage.tx = require('./lib/storage/tx')

//
ccwallet.tx = {}
ccwallet.tx.manager = require('./lib/tx/manager')

// util
ccwallet.util = {}
ccwallet.util.bitcoin = require('./lib/util/bitcoin')
ccwallet.util.const = require('./lib/util/const')
ccwallet.util.enum = require('./lib/util/enum')
ccwallet.util.SyncMixin = require('./lib/util/sync-mixin')
