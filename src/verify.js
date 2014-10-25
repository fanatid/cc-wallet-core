var _ = require('lodash')

var cclib = require('./cclib')
var bitcoin = cclib.bitcoin
var verify = cclib.verify
var createInstanceCheck = verify.createInstanceCheck


function isLength(thing, value) { return thing.length === length }

var networks = Object.keys(bitcoin.networks).map(function(key) { return bitcoin.networks[key] })
function isBitcoinNetwork(thing) {
  return networks.indexOf(thing) !== -1
}

function isHexSymbol(sym) { return '0123456789abcdef'.indexOf(sym) !== -1 }
function isRawCoin(thing) {
  return (
    _.isObject(thing) &&
    _.isString(thing.txId) &&
    thing.txId.length === 64 &&
    thing.txId.toLowerCase().split('').every(isHexSymbol) &&
    _.isNumber(thing.outIndex) &&
    _.isNumber(thing.value) &&
    _.isString(thing.script) &&
    _.isString(thing.address)
  )
}


var functions = {
  buffer: Buffer.isBuffer,
  length: isLength,

  HDNode: createInstanceCheck(function() { return bitcoin.HDNode }),
  bitcoinNetwork: isBitcoinNetwork,

  Wallet: createInstanceCheck(function() { return require('./Wallet') }),

  Address: createInstanceCheck(function() { return require('./address').Address }),
  AddressManager: createInstanceCheck(function() { return require('./address').AddressManager }),
  AddressStorage: createInstanceCheck(function() { return require('./address').AddressStorage }),

  AssetDefinition: createInstanceCheck(function() { return require('./asset').AssetDefinition }),
  AssetDefinitionManager: createInstanceCheck(function() { return require('./asset').AssetDefinitionManager }),
  AssetDefinitionStorage: createInstanceCheck(function() { return require('./asset').AssetDefinitionStorage }),
  AssetTarget: createInstanceCheck(function() { return require('./asset').AssetTarget }),
  AssetValue: createInstanceCheck(function() { return require('./asset').AssetValue }),

  BlockchainBase: createInstanceCheck(function() { return require('./blockchain').BlockchainBase }),

  rawCoin: isRawCoin,
  Coin: createInstanceCheck(function() { return require('./coin').Coin }),
  CoinManager: createInstanceCheck(function() { return require('./coin').CoinManager }),
  CoinQuery: createInstanceCheck(function() { return require('./coin').CoinQuery }),
  CoinStorage: createInstanceCheck(function() { return require('./coin').CoinStorage }),

  AssetTx: createInstanceCheck(function() { return require('./tx').AssetTx }),
  BaseTxDb: createInstanceCheck(function() { return require('./tx').BaseTxDb }),
  RawTx: createInstanceCheck(function() { return require('./tx').RawTx }),
  TxFetcher: createInstanceCheck(function() { return require('./tx').TxFetcher }),
  TxStorage: createInstanceCheck(function() { return require('./tx').TxStorage })
}

var expected = {
  buffer: 'Buffer',
  length: 'invalid length',

  HDNode: 'HDNode',
  bitcoinNetwork: 'Object from bitcoinjs-lib.networks',

  Wallet: 'Wallet',

  Address: 'Address',
  AddressManager: 'AddressManager',
  AddressStorage: 'AddressStorage',

  AssetDefinition: 'AssetDefinition',
  AssetDefinitionManager: 'AssetDefinitionManager',
  AssetDefinitionStorage: 'AssetDefinitionStorage',
  AssetTarget: 'AssetTarget',
  AssetValue: 'AssetValue',

  BlockchainBase: 'BlockchainBase',

  rawCoin: 'raw Coin Object',
  Coin: 'Coin',
  CoinManager: 'CoinManager',
  CoinQuery: 'CoinQuery',
  CoinStorage: 'CoinStorage',

  AssetTx: 'AssetTx',
  BaseTxDb: 'BaseTxDb',
  RawTx: 'RawTx',
  TxFetcher: 'TxFetcher',
  TxStorage: 'TxStorage'
}


verify.extendVerify(verify, functions, expected)
module.exports = verify
