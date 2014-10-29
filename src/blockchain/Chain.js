var inherits = require('util').inherits

var bitcoin = require('../bitcoin')
var _ = require('lodash')
var LRU = require('lru-cache')
var Q = require('q')
var request = require('request')

var BlockchainBase = require('./BlockchainBase')


/**
 * BlockchainState that uses [Chain.com API]{@link https://chain.com/docs}
 *
 * @class Chain
 * @extends BlockchainBase
 *
 * @param {Object} opts
 * @param {boolean} opts.testnet
 * @param {string} [opts.apiKeyId=DEMO-4a5e1e4]
 * @param {number} [opts.requestTimeout=5*1000]
 * @param {number} [opts.maxCacheSize=500]
 * @param {number} [opts.maxCacheAge=10*1000] Cache live in ms
 * @param {BaseTxDb} [opts.txDb] Get transactions from TxDb, optional
 */
function Chain(opts) {
  opts = _.extend({
    testnet: false,
    apiKeyId: 'DEMO-4a5e1e4',
    requestTimeout: 5*1000,
    maxCacheSize: 500,
    maxCacheAge: 10*1000
  }, opts)


  BlockchainBase.call(this)

  this.isTestnet = opts.testnet
  this.baseURL = 'https://api.chain.com/v1/' + (this.isTestnet ? 'testnet3' : 'bitcoin')
  this.apiKeyId = opts.apiKeyId

  this.cache = LRU({
    max: opts.maxCacheSize,
    maxAge: opts.maxCacheAge
  })

  this.requestTimeout = opts.requestTimeout + 25
  this.requestPathCache = LRU({ maxAge: this.requestTimeout })

  if (!_.isUndefined(opts.txDb))
    this.txDb = opts.txDb
}

inherits(Chain, BlockchainBase)

/**
 * @callback Chain~request
 * @param {?Error} error
 * @param {string} response
 */

/**
 * Make request to the server
 *
 * @param {string} path Path to resource
 * @param {Object} [data=null] Data for POST request, may be missed
 * @param {Chain~request} cb
 */
Chain.prototype.request = function(path, data, cb) {
  if (_.isFunction(data) && _.isUndefined(cb)) {
    cb = data
    data = null
  }

  var self = this

  /** check in cache */
  var cachedValue = self.cache.get(path)
  if (!_.isUndefined(cachedValue)) {
    process.nextTick(function() { cb(null, cachedValue) })
    return
  }

  /** check already requested */
  if (!_.isUndefined(self.requestPathCache.get(path))) {
    setTimeout(function() { self.request(path, data, cb) }, 25)
    return
  }

  /** make request */
  self.requestPathCache.set(path, true)
  var requestOpts = {
    method: data === null ? 'GET' : 'POST',
    uri: self.baseURL + path + '?api-key-id=' + self.apiKeyId,
    body: JSON.stringify(data),
    timeout: self.requestTimeout,
    json: true
  }

  Q.nfcall(request, requestOpts).spread(function(response, body) {
    if (response.statusCode !== 200)
      throw new Error('Request error: ' + response.statusMessage)

    return body

  }).done(function(data) { cb(null, data) }, function(error) { cb(error) })
}

/**
 * @callback Chain~getBlockCount
 * @param {?Error} error
 * @param {number} blockCount
 */

/**
 * Get block count in blockchain
 *
 * @param {Chain~getBlockCount} cb
 */
Chain.prototype.getBlockCount = function(cb) {
  Q.ninvoke(this, 'request', '/blocks/latest').then(function(response) {
    return response.height

  }).done(function(blockCount) { cb(null, blockCount) }, function(error) { cb(error) })
}

/**
 * @callback Chain~getTx
 * @param {?Error} error
 * @param {bitcoinjs-lib.Transaction} tx
 */

/**
 * Get transaction by txId
 *
 * @param {string} txId bitcoinjs-lib.Transaction id
 * @param {Chain~getTx} cb
 */
Chain.prototype.getTx = function(txId, cb) {
  var self = this

  Q.fcall(function() {
    if (!_.isUndefined(self.txDb)) {
      var tx = self.txDb.getTxById(txId)
      if (tx !== null)
        return tx
    }

    return Q.ninvoke(self, 'request', '/transactions/' + txId + '/hex').then(function(response) {
      return bitcoin.Transaction.fromHex(response.hex)
    })

  }).then(function(tx) {
    if (tx.getId() !== txId)
      throw new Error('Received tx is incorrect')

    return tx

  }).done(function(tx) { cb(null, tx) }, function(error) { cb(error) })
}

/**
 * @callback Chain~getTxBlockHash
 * @param {?Error} error
 * @param {string} blockHash
 */

/**
 * @param {string} txId
 * @param {Chain~getTxBlockHash} cb
 */
Chain.prototype.getTxBlockHash = function(txId, cb) {
  Q.ninvoke(this, 'request', '/transactions/' + txId).then(function(response) {
    return response.block_hash

  }).done(function(blockHash) { cb(null, blockHash) }, function(error) { cb(error) })
}

/**
 * @callback Chain~getBlockHeight
 * @param {?Error} error
 * @param {number} height
 */

/**
 * @param {string} blockHash
 * @param {Chain~getBlockHeight} cb
 */
Chain.prototype.getBlockHeight = function(blockHash, cb) {
  Q.ninvoke(this, 'request', '/blocks/' + blockHash).then(function(response) {
    return response.height

  }).done(function(blockHash) { cb(null, blockHash) }, function(error) { cb(error) })
}

/**
 * @callback BlockchainBase~getBlockTime
 * @param {?Error} error
 * @param {number} timestamp
 */

/**
 * @param {string} blockHash
 * @param {BlockchainBase~getBlockTime} cb
 */
Chain.prototype.getBlockTime = function(blockHash, cb) {
  Q.ninvoke(this, 'request', '/blocks/' + blockHash).then(function(response) {
    return Math.round(Date.parse(response.time)/1000)

  }).done(function(height) { cb(null, height) }, function(error) { cb(error) })
}

/**
 * @callback Chain~sendTx
 * @param {?Error} error
 * @param {string} txId
 */

/**
 * Send transaction tx to server which broadcast tx to network
 *
 * @param {bitcoinjs-lib.Transaction} tx
 * @param {Chain~sendTx} cb
 */
Chain.prototype.sendTx = function(tx, cb) {
  Q.ninvoke(this, 'request', '/transactions', { 'hex': tx.toHex() }).then(function(response) {
    return response.transaction_hash

  }).done(function(txId) { cb(null, txId) }, function(error) { cb(error) })
}

/**
 * @typedef CoinObject
 * @type {Object}
 * @property {string} txId
 * @property {number} outIndex
 * @property {number} value Coin value in satoshi
 * @property {string} script
 * @property {string} address
 * @property {number} confrimations
 */

/**
 * @callback Chain~getUTXO
 * @param {?Error} error
 * @param {CoinObject[]} utxo
 */

/**
 * Get UTXO for given address
 * @abstract
 * @param {string} address
 * @param {Chain~getUTXO} cb
 */
Chain.prototype.getUTXO = function(address, cb) {
  Q.ninvoke(this, 'request', '/addresses/' + address + '/unspents').then(function(rawCoins) {
    return rawCoins.map(function(rawCoin) {
      return {
        txId: rawCoin.transaction_hash,
        outIndex: rawCoin.output_index,
        value: rawCoin.value,
        script: rawCoin.script_hex,
        address: address,
        confirmations: rawCoin.confirmations
      }
    })

  }).done(function(coins) { cb(null, coins) }, function(error) { cb(error) })  
}

/**
 * @typedef HistoryObject
 * @type {Object}
 * @property {string} txId
 * @property {number} confirmations
 */

/**
 * @callback Chain~getHistory
 * @param {?Error} error
 * @param {HistoryObject[]} records
 */

/**
 * Get transaction Ids for given address
 * @abstract
 * @param {string} address
 * @param {Chain~getHistory} cb
 */
Chain.prototype.getHistory = function(address, cb) {
  Q.ninvoke(this, 'request', '/addresses/' + address + '/transactions').then(function(records) {
    return records.map(function(record) {
      return { txId: record.hash, confirmations: record.confirmations }
    })

  }).done(function(records) { cb(null, records) }, function(error) { cb(error) }) 
}


module.exports = Chain
