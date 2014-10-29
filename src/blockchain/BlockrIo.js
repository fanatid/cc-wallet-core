var inherits = require('util').inherits

var bitcoin = require('../bitcoin')
var _ = require('lodash')
var LRU = require('lru-cache')
var Q = require('q')
var qs = require('querystring')
var request = require('request')

var BlockchainBase = require('./BlockchainBase')


/**
 * BlockchainState that uses [Blockr.io API]{@link http://btc.blockr.io/documentation/api}
 *
 * @class BlockrIo
 * @extends BlockchainBase
 *
 * @param {Object} opts
 * @param {boolean} opts.testnet
 * @param {number} [opts.requestTimeout=5*1000]
 * @param {number} [opts.maxCacheSize=500]
 * @param {number} [opts.maxCacheAge=10*1000] Cache live in ms
 * @param {BaseTxDb} [opts.txDb] Get transactions from TxDb, optional
 */
function BlockrIo(opts) {
  opts = _.extend({
    testnet: false,
    requestTimeout: 5*1000,
    maxCacheSize: 500,
    maxCacheAge: 10*1000
  }, opts)


  BlockchainBase.call(this)

  this.isTestnet = opts.testnet

  this.cache = LRU({
    max: opts.maxCacheSize,
    maxAge: opts.maxCacheAge
  })

  this.requestTimeout = opts.requestTimeout + 25
  this.requestPathCache = LRU({ maxAge: this.requestTimeout })

  if (!_.isUndefined(opts.txDb))
    this.txDb = opts.txDb
}

inherits(BlockrIo, BlockchainBase)

/**
 * @callback BlockrIo~request
 * @param {?Error} error
 * @param {string} response
 */

/**
 * Make request to the server
 *
 * @param {string} path Path to resource
 * @param {Object} [data=null] Data for POST request, may be missed
 * @param {BlockrIo~request} cb
 */
BlockrIo.prototype.request = function(path, data, cb) {
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
  var host = self.isTestnet ? 'tbtc.blockr.io' : 'btc.blockr.io'
  var requestOpts = {
    method: data === null ? 'GET' : 'POST',
    uri: 'http://' + host + path,
    body: qs.encode(data),
    timeout: self.requestTimeout
  }

  var maxRetries = 5
  var retries = maxRetries
  var retryTime = 50

  /**
   * @return {Q.Promise}
   */
  function doRequest() {
    return Q.nfcall(request, requestOpts).spread(function(response, body) {
      if (response.statusCode !== 200)
        throw new Error('Request error: ' + response.statusMessage)

      var result = JSON.parse(body)
      if (result.status === 'success') {
        self.cache.set(path, result.data)
        return result.data
      }

      if (result.message === 'Too many requests. Wait a bit...') {
        if (--retries === 0) {
          var msg = [
            'Blockr complained about too many request (',
            maxRetries,
            ' x ',
            retryTime,
            'ms.).'
          ].join('')

          throw new Error(msg)
        }

        retryTime = retryTime * 2
        return Q.delay(retryTime).then(doRequest)
      }

      throw new Error(result.message || 'Bad data')
    })
  }

  return doRequest().done(function(data) { cb(null, data) }, function(error) { cb(error) })
}

/**
 * @callback BlockrIo~getBlockCount
 * @param {?Error} error
 * @param {number} blockCount
 */

/**
 * Get block count in blockchain
 *
 * @param {BlockrIo~getBlockCount} cb
 */
BlockrIo.prototype.getBlockCount = function(cb) {
  var self = this

  Q.fcall(function() {
    return Q.ninvoke(self, 'request', '/api/v1/block/info/last')

  }).then(function(response) {
    if (!_.isNumber(response.nb))
      throw new Error('Expected number nb, got ' + response.nb)

    return response.nb

  }).done(function(blockCount) { cb(null, blockCount) }, function(error) { cb(error) })
}

/**
 * @callback BlockrIo~getTx
 * @param {?Error} error
 * @param {bitcoinjs-lib.Transaction} tx
 */

/**
 * Get transaction by txId
 *
 * @param {string} txId bitcoinjs-lib.Transaction id
 * @param {BlockrIo~getTx} cb
 */
BlockrIo.prototype.getTx = function(txId, cb) {
  var self = this

  Q.fcall(function() {
    if (!_.isUndefined(self.txDb)) {
      var tx = self.txDb.getTxById(txId)
      if (tx !== null)
        return tx
    }

    return Q.ninvoke(self, 'request', '/api/v1/tx/raw/' + txId).then(function(response) {
      return bitcoin.Transaction.fromHex(response.tx.hex)
    })

  }).then(function(tx) {
    if (tx.getId() !== txId)
      throw new Error('Received tx is incorrect')

    return tx

  }).done(function(tx) { cb(null, tx) }, function(error) { cb(error) })
}

/**
 * @callback BlockrIo~getTxBlockHash
 * @param {?Error} error
 * @param {string} blockHash
 */

/**
 * @param {string} txId
 * @param {BlockrIo~getTxBlockHash} cb
 */
BlockrIo.prototype.getTxBlockHash = function(txId, cb) {
  Q.ninvoke(this, 'request', '/api/v1/tx/raw/' + txId).then(function(response) {
    if (_.isUndefined(response.tx.blockhash))
      return null

    return response.tx.blockhash

  }).done(function(blockHash) { cb(null, blockHash) }, function(error) { cb(error) })
}

/**
 * @callback BlockrIo~getBlockHeight
 * @param {?Error} error
 * @param {number} height
 */

/**
 * @param {string} blockHash
 * @param {BlockrIo~getBlockHeight} cb
 */
BlockrIo.prototype.getBlockHeight = function(blockHash, cb) {
  Q.ninvoke(this, 'request', '/api/v1/block/info/' + blockHash).then(function(response) {
    return response.nb

  }).done(function(height) { cb(null, height) }, function(error) { cb(error) })
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
BlockrIo.prototype.getBlockTime = function(blockHash, cb) {
  Q.ninvoke(this, 'request', '/api/v1/block/info/' + blockHash).then(function(response) {
    return Math.round(Date.parse(response.time_utc)/1000)

  }).done(function(height) { cb(null, height) }, function(error) { cb(error) })
}

/**
 * @callback BlockrIo~sendTx
 * @param {?Error} error
 * @param {string} txId
 */

/**
 * Send transaction tx to server which broadcast tx to network
 *
 * @param {bitcoinjs-lib.Transaction} tx
 * @param {BlockrIo~sendTx} cb
 */
BlockrIo.prototype.sendTx = function(tx, cb) {
  var self = this

  Q.fcall(function() {
    return Q.ninvoke(self, 'request', '/api/v1/tx/push', { 'hex': tx.toHex() })

  }).done(function(txId) { cb(null, txId) }, function(error) { cb(error) })
}

/**
 * Parse bitcoin amount (BlockrIO give us btc value not in satoshi)
 *
 * @param {string} amount
 * @return {number}
 */
function parseAmount(amount) {
  var items = amount.split('.')
  return parseInt(items[0])*100000000 + parseInt(items[1])
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
 * @callback BlockrIo~getUTXO
 * @param {?Error} error
 * @param {CoinObject[]} utxo
 */

/**
 * Get UTXO for given address
 * @abstract
 * @param {string} address
 * @param {BlockrIo~getUTXO} cb
 */
BlockrIo.prototype.getUTXO = function(address, cb) {
  var self = this

  Q.fcall(function() {
    var rnd = (Math.random()+1).toString()
    return Q.ninvoke(self, 'request', '/api/v1/address/unspent/' + address + '?unconfirmed=' + rnd)

  }).then(function(response) {
    if (response.address !== address)
      throw new Error('response address not matched')

    return response.unspent

  }).then(function(coins) {
    var records = coins.map(function(rawCoin) {
      return {
        txId: rawCoin.tx,
        outIndex: rawCoin.n,
        value: parseAmount(rawCoin.amount),
        script: rawCoin.script,
        address: address,
        confirmations: rawCoin.confirmations
      }
    })

    return records

  }).done(function(utxo) { cb(null, utxo) }, function(error) { cb(error) })
}

/**
 * @typedef HistoryObject
 * @type {Object}
 * @property {string} txId
 * @property {number} confirmations
 */

/**
 * @callback BlockrIo~getHistory
 * @param {?Error} error
 * @param {HistoryObject[]} records
 */

/**
 * Get transaction Ids for given address
 * @abstract
 * @param {string} address
 * @param {BlockrIo~getHistory} cb
 */
BlockrIo.prototype.getHistory = function(address, cb) {
  var self = this

  Q.fcall(function() {
    return Q.ninvoke(self, 'request', '/api/v1/address/txs/' + address)

  }).then(function(response) {
    if (response.address !== address)
      throw new Error('response address not matched')

    return response.txs

  }).then(function(txs) {
    var records = txs.map(function(tx) {
      return { txId: tx.tx, confirmations: tx.confirmations }
    })

    return records

  }).done(function(records) { cb(null, records) }, function(error) { cb(error) })
}


module.exports = BlockrIo
