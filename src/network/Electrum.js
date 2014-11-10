var inherits = require('util').inherits

var _ = require('lodash')
var Q = require('q')
var socket = require('socket.io-client')

var bitcoin = require('../bitcoin')
var verify = require('../verify')
var Network = require('./Network')


/**
 * @class Electrum
 * @extends Network
 *
 * @param {Object} [opts]
 * @param {boolean} [opts.testnet=false]
 * @param {string} [opts.url]
 */
function Electrum(opts) {
  opts = _.extend({ testnet: false }, opts)
  opts = _.extend({
    url: 'ws://devel.hz.udoidio.info:' + (opts.testnet ? '8784' : '8783')
  }, opts)
  verify.boolean(opts.testnet)
  verify.string(opts.url)

  var self = this
  Network.call(self)

  self._requestId = 0
  self._requests = {}

  // Todo: resubscribe on reconnect?
  self._socket = socket(opts.url, { forceNew: true })
  self._socket.on('connect_error', function(error) { self.emit('error', error) })
  self._socket.on('connect', function() { self.emit('connect') })
  self._socket.on('disconnect', function() { self.emit('disconnect') })

  self._socket.on('message', function(response) {
    try {
      response = JSON.parse(response)

    } catch(error) {
      return

    }

    if (response.id === null) {
      var isMethod = response.method === 'blockchain.numblocks.subscribe'
      var isArgs = _.isNumber(response.result)
      if (isMethod && isArgs)
        return self._setCurrentHeight(response.result)

      isMethod = response.method === 'blockchain.address.subscribe'
      isArgs = _.isArray(response.result) && _.isString(response.result[0])
      if (isMethod && isArgs)
        return self.emit('touchAddress', response.result[0])
    }

    var deferred = self._requests[response.id]
    if (_.isUndefined(deferred))
      return

    if (_.isUndefined(response.error))
      deferred.resolve(response.result)
    else
      deferred.reject(response.error)

    delete self._requests[response.id]
  })

  self._request('blockchain.numblocks.subscribe').then(function(height) {
    verify.number(height)
    self._setCurrentHeight(height)

  }).catch(function(error) { self.emit('error', error) })
}

inherits(Electrum, Network)

/**
 * @param {string} method
 * @param {*[]} [params]
 * @return {Q.Promise}
 */
Electrum.prototype._request = function(method, params) {
  verify.string(method)
  if (_.isUndefined(params)) params = []
  verify.array(params)

  var deferred = Q.defer()

  var request = { id: this._requestId++, method: method, params: params }
  this._requests[request.id] = deferred

  this._socket.send(JSON.stringify(request))

  return deferred.promise
}

/**
 * {@link Network~getHeader}
 */
Electrum.prototype.getHeader = function(height, cb) {
  verify.number(height)
  verify.function(cb)

  this._request('blockchain.block.get_header', [height]).then(function(response) {
    verify.number(response.version)
    if (height === 0) {
      verify.null(response.prev_block_hash)
    } else {
      verify.string(response.prev_block_hash)
      verify.length(response.prev_block_hash, 64)
    }
    verify.string(response.merkle_root)
    verify.length(response.merkle_root, 64)
    verify.number(response.timestamp)
    verify.number(response.bits)
    verify.number(response.nonce)

    return {
      version: response.version,
      prevBlockHash: response.prev_block_hash,
      merkleRoot: response.merkle_root,
      timestamp: response.timestamp,
      bits: response.bits,
      nonce: response.nonce
    }

  }).done(function(data) { cb(null, data) }, function(error) { cb(error) })
}

/**
 * {@link Network~getChunk}
 */
Electrum.prototype.getChunk = function(index, cb) {
  verify.number(index)
  verify.function(cb)

  this._request('blockchain.block.get_chunk', [index]).then(function(chunkHex) {
    verify.blockchainChunk(chunkHex)

    return chunkHex

  }).done(function(chunkHex) { cb(null, chunkHex) }, function(error) { cb(error) })
}

/**
 * {@link Network~getTx}
 */
Electrum.prototype.getTx = function(txId, cb) {
  verify.txId(txId)
  verify.function(cb)

  this._request('blockchain.transaction.get', [txId]).then(function(rawTx) {
    var tx = bitcoin.Transaction.fromHex(rawTx)
    if (tx.getId() !== txId)
      throw new Error('Received tx is incorrect')

    return tx

  }).done(function(tx) { cb(null, tx) }, function(error) { cb(error) })
}

/**
 * {@link Network~getMerkle}
 */
Electrum.prototype.getMerkle = function(txId, height, cb) {
  if (_.isFunction(height) && _.isUndefined(cb)) {
    cb = height
    height = undefined
  }

  verify.txId(txId)
  if (!_.isUndefined(height)) verify.number(height)
  verify.function(cb)

  this._request('blockchain.transaction.get_merkle', [txId, height]).then(function(response) {
    verify.number(response.block_height)
    verify.array(response.merkle)
    response.merkle.forEach(verify.txId)
    verify.number(response.pos)

    var result = {
      height: response.block_height,
      merkle: response.merkle,
      index: response.pos
    }

    return result

  }).done(function(data) { cb(null, data) }, function(error) { cb(error) })
}

/**
 * {@link Network~sendTx}
 */
Electrum.prototype.sendTx = function(tx, cb) {
  verify.Transaction(tx)
  verify.function(cb)

  this._request('blockchain.transaction.broadcast', [tx.toHex()]).then(function(txId) {
    if (txId !== tx.getId())
      throw new Error('Received txId is incorrect')

    return txId

  }).done(function(txId) { cb(null, txId) }, function(error) { cb(error) })
}

/**
 * {@link Network~getHistory}
 */
Electrum.prototype.getHistory = function(address, cb) {
  verify.string(address)
  verify.function(cb)

  this._request('blockchain.address.get_history', [address]).then(function(entries) {
    verify.array(entries)

    return entries.map(function(entry) {
      verify.txId(entry.tx_hash)
      verify.number(entry.height)

      return { txId: entry.tx_hash, height: entry.height }
    })

  }).done(function(entries) { cb(null, entries) }, function(error) { cb(error) })
}

/**
 * {@link Network~getHistory}
 */
Electrum.prototype.getUnspent = function(address, cb) {
  verify.string(address)
  verify.function(cb)

  this._request('blockchain.address.listunspent', [address]).then(function(unspent) {
    verify.array(unspent)

    return unspent.map(function(entry) {
      verify.txId(entry.tx_hash)
      verify.number(entry.tx_pos)
      verify.number(entry.value)
      verify.number(entry.height)

      return { txId: entry.tx_hash, outIndex: entry.tx_pos, value: entry.value, height: entry.height }
    })

  }).done(function(unspent) { cb(null, unspent) }, function(error) { cb(error) })
}

/**
 * {@link Network~subscribeAddress}
 */
Electrum.prototype.subscribeAddress = function(address, cb) {
  verify.string(address)
  verify.function(cb)

  this._request('blockchain.address.subscribe', [address])
    .done(function() { cb(null) }, function(error) { cb(error) })
}


module.exports = Electrum