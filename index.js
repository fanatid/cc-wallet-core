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
ccwallet.coin.Coin = require('./lib/coin/coin')
ccwallet.coin.Manager = require('./lib/coin/manager')
ccwallet.coin.Query = require('./lib/coin/query')

//
ccwallet.history = {}
ccwallet.history.Entry = require('./lib/history/entry')
ccwallet.history.Manager = require('./lib/history/manager')
ccwallet.history.Target = require('./lib/history/target')

// storage
ccwallet.storage = {}
ccwallet.storage.addresses = require('./lib/storage/addresses')
ccwallet.storage.assets = require('./lib/storage/assets')
ccwallet.storage.config = require('./lib/storage/config')
ccwallet.storage.locktime = require('./lib/storage/locktime')
ccwallet.storage.tx = require('./lib/storage/tx')

//
ccwallet.tx = {}
ccwallet.tx.Asset = require('./lib/tx/asset')
ccwallet.tx.Manager = require('./lib/tx/manager')
ccwallet.tx.Operational = require('./lib/tx/operational')
ccwallet.tx.Raw = require('./lib/tx/raw')
ccwallet.tx.transform = require('./lib/tx/transformer')

// util
ccwallet.util = {}
ccwallet.util.bitcoin = require('./lib/util/bitcoin')
ccwallet.util.const = require('./lib/util/const')
ccwallet.util.enum = require('./lib/util/enum')
ccwallet.util.SyncMixin = require('./lib/util/sync-mixin')
