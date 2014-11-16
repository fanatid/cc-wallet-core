var inherits = require('util').inherits

var _ = require('lodash')
var Q = require('q')
var request = require('request')

var bitcoin = require('../bitcoin')
var verify = require('../verify')
var Network = require('./Network')


/**
 * [Chain.com API]{@link https://chain.com/docs}
 *
 * @class Chain
 * @extends Network
 *
 * @param {Wallet} wallet
 * @param {Object} [opts]
 * @param {boolean} [opts.testnet=false]
 * @param {string} [opts.apiKeyId=DEMO-4a5e1e4]
 * @param {number} [opts.requestTimeout=10*1000]
 * @param {number} [opts.refreshInterval=30*1000]
 */
function Chain(wallet, opts) {
  verify.Wallet(wallet)
  opts = _.extend({
    testnet: false,
    apiKeyId: 'DEMO-4a5e1e4',
    requestTimeout: 10*1000,
    refreshInterval: 30*1000
  }, opts)
  verify.boolean(opts.testnet)
  verify.string(opts.apiKeyId)
  verify.number(opts.requestTimeout)
  verify.number(opts.refreshInterval)

  var self = this
  Network.call(self)

  self._wallet = wallet

  self._blockChain = opts.testnet ? 'testnet3' : 'bitcoin'
  self._apiKeyId = opts.apiKeyId
  self._requestTimeout = opts.requestTimeout
  self._subscribedAddresses = {}

  /**
   * @return {Q.Promise}
   */
  function getNetworkHeight() {
    return self._request('/blocks/latest').then(function(response) {
      if (self.getCurrentHeight() !== response.height)
        return self._setCurrentHeight(response.height)

    }).catch(function(error) {
      self.emit('error', error)

    }).finally(function() { Q.delay(opts.refreshInterval).then(getNetworkHeight) })
  }
  getNetworkHeight().then(function() {
    self.emit('connect')
  })

  /**
   * @return {Q.Promise}
   */
  function testSubscribedAddresses() {
    return Q.all(Object.keys(self._subscribedAddresses).map(function(address) {
      return Q.ninvoke(self, 'getUnspent', address).then(function(entries) {
        var isTouched = false
        var addressEntries = self._subscribedAddresses[address]
        var entryTxIds = _.indexBy(entries, 'txId')

        _.keys(addressEntries).forEach(function(txId) {
          if (_.isUndefined(entryTxIds[txId])) {
            delete addressEntries[txId]
            isTouched = true
          }
        })
        entries.forEach(function(entry) {
          if (addressEntries[entry.txId] !== entry.height) {
            addressEntries[entry.txId] = entry.height
            isTouched = true
          }
        })

        if (isTouched)
          self.emit('touchAddress', address)
      })

    })).catch(function(error) {
      self.emit('error', error)

    }).finally(function() { Q.delay(opts.refreshInterval).then(testSubscribedAddresses) })
  }
  testSubscribedAddresses()
}

inherits(Chain, Network)

/**
 * @param {string} path
 * @return {string}
 */
Chain.prototype._getRequestURL = function(path) {
  verify.string(path)
  return 'https://api.chain.com/v1/' + this._blockChain + path + '?api-key-id=' + this._apiKeyId
}

/**
 * @param {string} path
 * @param {Object} [data] Data for POST request, may be missed
 * @return {Q.Promise<string>}
 */
Chain.prototype._request = function(path, data) {
  var requestOpts = {
    method: _.isUndefined(data) ? 'GET' : 'POST',
    uri: this._getRequestURL(path),
    body: JSON.stringify(data),
    timeout: this._requestTimeout,
    zip: true,
    json: true
  }

  return Q.nfcall(request, requestOpts).spread(function(response, body) {
    if (response.statusCode !== 200)
      throw new Error('Request error: ' + response.statusMessage)

    return body
  })
}

/**
 * {@link Network~getHeader}
 */
Chain.prototype.getHeader = function(height, cb) {
  verify.number(height)
  verify.function(cb)

  this._request('/blocks/' + height).then(function(response) {
    verify.number(response.version)
    if (height === 0) {
      verify.null(response.previous_block_hash)
    } else {
      verify.string(response.previous_block_hash)
      verify.length(response.previous_block_hash, 64)
    }
    verify.string(response.merkle_root)
    verify.length(response.merkle_root, 64)
    verify.string(response.time)
    verify.hexString(response.bits)
    verify.number(response.nonce)

    return {
      version: response.version,
      prevBlockHash: response.previous_block_hash,
      merkleRoot: response.merkle_root,
      timestamp: Date.parse(response.time)/1000,
      bits: parseInt(response.bits, 16),
      nonce: response.nonce
    }

  }).done(function(result) { cb(null, result) }, function(error) { cb(error) })
}

/**
 * {@link Network~getTx}
 */
Chain.prototype.getTx = function(txId, cb) {
  verify.txId(txId)
  verify.function(cb)

  var tx = this._wallet.getTxDb().getTx(txId)
  if (tx !== null)
    return process.nextTick(function() { cb(null, tx) })

  this._request('/transactions/' + txId + '/hex').then(function(response) {
    verify.object(response)

    tx = bitcoin.Transaction.fromHex(response.hex)
    if (tx.getId() !== txId)
      throw new Error('Received tx is incorrect')

    return tx

  }).done(function(result) { cb(null, result) }, function(error) { cb(error) })
}

/**
 * {@link Network~sendTx}
 */
Chain.prototype.sendTx = function(tx, cb) {
  verify.Transaction(tx)
  verify.function(cb)

  this._request('/transactions', { 'hex': tx.toHex() }).then(function(response) {
    if (response.transaction_hash !== tx.getId())
      throw new Error('Received txId is incorrect')

    return response.transaction_hash

  }).done(function(txId) { cb(null, txId) }, function(error) { cb(error) })
}

/**
 * {@link Network~getHistory}
 */
Chain.prototype.getHistory = function(address, cb) {
  verify.string(address)
  verify.function(cb)

  var currentHeight = this.getCurrentHeight()

  this._request('/addresses/' + address + '/transactions').then(function(response) {
    verify.array(response)

    var entries = response.map(function(entry) {
      verify.txId(entry.hash)
      verify.number(entry.confirmations)

      if (entry.confirmations === 0)
        entry.confirmations = currentHeight + 1

      return {
        txId: entry.hash,
        height: currentHeight - entry.confirmations + 1
      }
    })

    return _.sortBy(entries, function(entry) {
      return entry.height === 0 ? Infinity : entry.height
    })

  }).done(function(result) { cb(null, result) }, function(error) { cb(error) })
}

/**
 * {@link Network~getHistory}
 */
Chain.prototype.getUnspent = function(address, cb) {
  verify.string(address)
  verify.function(cb)

  var currentHeight = this.getCurrentHeight()

  this._request('/addresses/' + address + '/unspents').then(function(response) {
    verify.array(response)

    var entries = response.map(function(entry) {
      verify.txId(entry.transaction_hash)
      verify.number(entry.output_index)
      verify.number(entry.value)
      verify.number(entry.confirmations)

      if (entry.confirmations === 0)
        entry.confirmations = currentHeight + 1

      return {
        txId: entry.transaction_hash,
        outIndex: entry.output_index,
        value: entry.value,
        height: currentHeight - entry.confirmations + 1
      }
    })

    return _.sortBy(entries, function(entry) {
      return entry.height === 0 ? Infinity : entry.height
    })

  }).done(function(result) { cb(null, result) }, function(error) { cb(error) })
}

/**
 * {@link Network~subscribeAddress}
 */
Chain.prototype.subscribeAddress = function(address, cb) {
  verify.string(address)
  verify.function(cb)

  if (_.isUndefined(this._subscribedAddresses[address]))
    this._subscribedAddresses[address] = {}

  process.nextTick(function() { cb(null) })
}


module.exports = Chain
