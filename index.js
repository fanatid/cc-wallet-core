'use strict'

var cccore = module.exports

// wallet
cccore.Wallet = require('./lib/wallet')

// library errors
cccore.errors = require('./lib/errors')

//
cccore.addresses = {}
cccore.addresses.Address = require('./lib/addresses/address')
cccore.addresses.Manager = require('./lib/addresses/manager')

//
cccore.assets = {}
cccore.assets.Definition = require('./lib/assets/definition')
cccore.assets.Manager = require('./lib/assets/manager')
cccore.assets.Target = require('./lib/assets/target')
cccore.assets.Value = require('./lib/assets/value')

//
cccore.coin = {}
cccore.coin.Coin = require('./lib/coin/coin')
cccore.coin.Manager = require('./lib/coin/manager')
cccore.coin.Query = require('./lib/coin/query')

//
cccore.history = {}
cccore.history.Entry = require('./lib/history/entry')
cccore.history.Manager = require('./lib/history/manager')
cccore.history.Target = require('./lib/history/target')

// storage
cccore.storage = {}
cccore.storage.addresses = require('./lib/storage/addresses')
cccore.storage.assets = require('./lib/storage/assets')
cccore.storage.config = require('./lib/storage/config')
cccore.storage.locktime = require('./lib/storage/locktime')
cccore.storage.tx = require('./lib/storage/tx')

//
cccore.tx = {}
cccore.tx.Asset = require('./lib/tx/asset')
cccore.tx.Manager = require('./lib/tx/manager')
cccore.tx.Operational = require('./lib/tx/operational')
cccore.tx.Raw = require('./lib/tx/raw')
cccore.tx.transform = require('./lib/tx/transformer')

// util
cccore.util = {}
cccore.util.bitcoin = require('./lib/util/bitcoin')
cccore.util.const = require('./lib/util/const')
cccore.util.enum = require('./lib/util/enum')
cccore.util.SyncMixin = require('./lib/util/sync-mixin')
