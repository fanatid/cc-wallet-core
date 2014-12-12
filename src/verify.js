var _ = require('lodash')

var cclib = require('./cclib')
var bitcoin = cclib.bitcoin
var verify = cclib.verify
var createInstanceCheck = verify.createInstanceCheck


function isLength(thing, value) { return thing.length === value }

function isBlockchainChunk(thing) {
  return verify.hexString(thing) && thing.length > 0 && thing.length <= 322240 && thing.length % 160 === 0
}

var networks = _.values(bitcoin.networks)
function isBitcoinNetwork(thing) {
  return _.some(networks, function (network) { return _.isEqual(network, thing) })
}

function isHexSymbol(sym) { return '0123456789abcdefABCDEF'.indexOf(sym) !== -1 }
function isRawCoin(thing) {
  return (
    _.isObject(thing) &&
    _.isString(thing.txId) &&
    thing.txId.length === 64 &&
    thing.txId.split('').every(isHexSymbol) &&
    _.isNumber(thing.outIndex) &&
    _.isNumber(thing.value) &&
    _.isString(thing.script) &&
    _.isString(thing.address)
  )
}


var functions = {
  buffer: Buffer.isBuffer,
  length: isLength,
  blockchainChunk: isBlockchainChunk,

  HDNode: createInstanceCheck(function () { return bitcoin.HDNode }),
  bitcoinNetwork: isBitcoinNetwork,

  Wallet: createInstanceCheck(function () { return require('./Wallet') }),

  Address: createInstanceCheck(function () { return require('./address').Address }),
  AddressManager: createInstanceCheck(function () { return require('./address').AddressManager }),
  AddressStorage: createInstanceCheck(function () { return require('./address').AddressStorage }),

  AssetDefinition: createInstanceCheck(function () { return require('./asset').AssetDefinition }),
  AssetDefinitionManager: createInstanceCheck(function () { return require('./asset').AssetDefinitionManager }),
  AssetDefinitionStorage: createInstanceCheck(function () { return require('./asset').AssetDefinitionStorage }),
  AssetTarget: createInstanceCheck(function () { return require('./asset').AssetTarget }),
  AssetValue: createInstanceCheck(function () { return require('./asset').AssetValue }),

  Blockchain: createInstanceCheck(function () { return require('./blockchain').Blockchain }),

  rawCoin: isRawCoin,
  Coin: createInstanceCheck(function () { return require('./coin').Coin }),
  CoinQuery: createInstanceCheck(function () { return require('./coin').CoinQuery }),
  CoinStorage: createInstanceCheck(function () { return require('./coin').CoinStorage }),
  CoinManager: createInstanceCheck(function () { return require('./coin').CoinManager }),

  HistoryEntry: createInstanceCheck(function () { return require('./history').HistoryEntry }),
  HistoryTarget: createInstanceCheck(function () { return require('./history').HistoryTarget }),
  HistoryStorage: createInstanceCheck(function () { return require('./history').HistoryStorage }),
  HistoryManager: createInstanceCheck(function () { return require('./history').HistoryManager }),

  Network: createInstanceCheck(function () { return require('./network').Network }),

  AssetTx: createInstanceCheck(function () { return require('./tx').AssetTx }),
  BaseTxDb: createInstanceCheck(function () { return require('./tx').BaseTxDb }),
  TxDb: createInstanceCheck(function () { return require('./tx').TxDb }),
  RawTx: createInstanceCheck(function () { return require('./tx').RawTx }),
  TxFetcher: createInstanceCheck(function () { return require('./tx').TxFetcher }),
  TxStorage: createInstanceCheck(function () { return require('./tx').TxStorage })
}

var expected = {
  buffer: 'Buffer',
  length: 'other length',
  blockchainChunk: 'blockchain chunk',

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

  Blockchain: 'Blockchain',

  rawCoin: 'raw Coin Object',
  Coin: 'Coin',
  CoinManager: 'CoinManager',
  CoinQuery: 'CoinQuery',
  CoinStorage: 'CoinStorage',

  Network: 'Network',

  AssetTx: 'AssetTx',
  BaseTxDb: 'BaseTxDb',
  TxDb: 'TxDb',
  RawTx: 'RawTx',
  TxFetcher: 'TxFetcher',
  TxStorage: 'TxStorage'
}


verify.extendVerify(verify, functions, expected)
module.exports = verify
