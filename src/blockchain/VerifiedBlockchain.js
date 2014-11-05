var assert = require('assert')
var inherits = require('util').inherits

var BigInteger = require('bigi')
var createError = require('errno').create
var bufferEqual = require('buffer-equal')
var _ = require('lodash')
var Q = require('q')
var zfill = require('zfill')

var bitcoin = require('../bitcoin')
var verify = require('../verify')
var Blockchain = require('./Blockchain')
var VerifiedBlockchainStorage = require('./VerifiedBlockchainStorage')


var LoopInterrupt = createError('LoopInterrupt')
var VerifyError = createError('VerifyError')


/**
 * @class VerifiedBlockchain
 * @extends Blockchain
 * @param {Network} network
 * @param {Object} [opts]
 * @param {boolean} [opts.testnet=false]
 */
function VerifiedBlockchain(network, opts) {
  verify.Network(network)
  opts = _.extend({ testnet: false }, opts)
  verify.boolean(opts.testnet)

  var self = this
  Blockchain.call(self)

  self._isTestnet = opts.testnet
  self._network = network

  self._currentHeight = -1
  self._currentBlockHash = new Buffer(32).fill(0)
  self._storage = new VerifiedBlockchainStorage()

  var storageChunksCount = self._storage.getChunksCount()
  var storageHeadersCount = self._storage.getHeadersCount()
  if (storageChunksCount > 0 || storageHeadersCount > 0) {
    self._currentHeight = storageChunksCount * 2016 + storageHeadersCount
    self._currentBlockHash = self._storage.getLastHash()
  }

  var running = false
  var queue = []
  function onNewHeight() {
    var promise = Q()

    if (running) {
      queue.push(Q.defer())
      promise = _.last(queue)
    }
    running = true

    promise.then(function() {
      return self._sync()

    }).catch(function(error) {
      self.emit('error', error)

    }).finally(function() {
      running = false
      if (queue.length > 0)
        queue.pop().resolve()
    })
  }

  self._network.on('newHeight', onNewHeight)
  onNewHeight()

  self._network.on('touchAddress', function(address) {
    self.emit('touchAddress', address)
  })
}

inherits(VerifiedBlockchain, Blockchain)

/**
 * {@link Blockchain~getCurrentHeight}
 */
VerifiedBlockchain.prototype.getCurrentHeight = function() {
  return this._currentHeight
}

/**
 * {@link Blockchain~getBlockTime}
 */
VerifiedBlockchain.prototype.getBlockTime = function(height, cb) {
  verify.function(cb)

  Q.ninvoke(this._network, 'getHeader', height)
    .done(function(header) { cb(null, header.timestamp) }, function(error) { cb(error) })
}

/**
 * {@link Blockchain~getTx}
 */
VerifiedBlockchain.prototype.getTx = function(txId, cb) {
  this._network.getTx(txId, cb)
}

/**
 * {@link Blockchain~sendTx}
 */
VerifiedBlockchain.prototype.sendTx = function(tx, cb) {
  this._network.sendTx(tx, cb)
}

/**
 * {@link Blockchain~getHistory}
 */
VerifiedBlockchain.prototype.getHistory = function(address, cb) {
  this._network.getHistory(address, cb)
}

/**
 * {@link Blockchain~subscribeAddress}
 */
VerifiedBlockchain.prototype.subscribeAddress = function(address, cb) {
  this._network.subscribeAddress(address, cb)
}

/**
 * @param {number} height
 * @return {Q.Promise<Buffer>}
 */
VerifiedBlockchain.prototype._getHeader = function(height) {
  verify.number(height)

  var self = this

  var chunkIndex = Math.floor(height / 2016)
  var headerIndex = height % 2016

  if (chunkIndex === self._storage.getChunksCount()) {
    if (headerIndex >= self._storage.getHeadersCount())
      return Q.fcall(function() { throw new Error('Header not found') })

    return Q(new Buffer(self._storage.getHeader(headerIndex), 'hex'))
  }

  return Q.ninvoke(self._network, 'getChunk', chunkIndex).then(function(chunkHex) {
    var chunk = new Buffer(chunkHex, 'hex')

    var chunkHash = bitcoin.crypto.hash256(chunk).toString('hex')
    if (chunkHash !== self._storage.getChunkHash(chunkIndex))
      throw new Error('Verify chunk error')

    if (chunk.length/80 <= headerIndex)
      throw new Error('Header not found')

    return chunk.slice(headerIndex*80, (headerIndex+1)*80)
  })
}

/**
 * @return {Q.Promise}
 */
VerifiedBlockchain.prototype._sync = function() {
  var self = this
  var deferred = Q.defer()

  var networkHeight = self._network.getCurrentHeight()
  var networkLastHash = self._network.getCurrentBlockHash()

  if (bufferEqual(self._currentBlockHash, networkLastHash) || networkHeight === -1) {
    deferred.resolve()
    return deferred.promise
  }

  var maxBits = 0x1d00ffff
  var maxTarget = new Buffer('00000000FFFF0000000000000000000000000000000000000000000000000000', 'hex')
  var maxTargetBI = BigInteger.fromHex(maxTarget.toString('hex'))
  var requestedHeight = null, chain = []
  var networkIndex, index

  /**
   * @param {number} index
   * @param {Buffer[]} chain
   * @return {Q.Promise<{bits: number, target: Buffer}>}
   */
  function getTarget(index, chain) {
    chain = chain || []

    if (index === 0)
      return Q({ bits: maxBits, target: maxTarget })

    var firstHeader, lastHeader
    return self._getHeader((index-1)*2016).then(function(buffer) {
      firstHeader = bitcoin.buffer2header(buffer)

    }).then(function() {
      return self._getHeader(index*2016-1).then(function(buffer) {
        lastHeader = bitcoin.buffer2header(buffer)

      }).then(function() {
        chain.forEach(function(data) {
          if (data.height === index*2016 - 1)
            lastHeader = data.header
        })
      })

    }).then(function() {
      var nActualTimestamp = lastHeader.timestamp - firstHeader.timestamp
      var nTargetTimestamp = 14*24*60*60
      nActualTimestamp = Math.max(nActualTimestamp, nTargetTimestamp/4)
      nActualTimestamp = Math.min(nActualTimestamp, nTargetTimestamp*4)

      var bits = lastHeader.bits
      var MM = 256*256*256
      var a = bits % MM
      if (a < 0x8000)
        a = a * 256

      var target = BigInteger(a.toString(), 10)
      target = target.multiply(BigInteger('2', 10).pow(8 * (Math.floor(bits/MM) - 3)))
      target = target.multiply(BigInteger(nActualTimestamp.toString(), 10))
      target = target.divide(BigInteger(nTargetTimestamp.toString(), 10))
      target = target.min(maxTargetBI)

      var c = zfill(target.toHex(), 64)
      var i = 32
      while (c.slice(0, 2) === '00') {
        c = c.slice(2)
        i -= 1
      }

      c = parseInt(c.slice(0, 6), 16)
      if (c > 0x800000) {
        c = Math.floor(c / 256)
        i += 1
      }

      return { bits: c + MM*i, target: new Buffer(target.toHex(), 'hex') }
    })
  }

  /**
   * @param {Buffer} hash
   * @param {Buffer} target
   * @return {boolean}
   */
  function isGoodHash(hash, target) {
    for (var i = 0; i < 32; ++i)
      if (hash[i] < target[i])
        return true

    return false
  }

  /**
   * @param {Buffer} currentHash
   * @param {Header} currentHeader
   * @param {Buffer} prevHash
   * @param {Header} prevHeader
   * @param {{bits: number, target: Buffer}} target
   * @throws {VerifyError}
   */
  function verifyHeader(currentHash, currentHeader, prevHash, prevHeader, target) {
    try {
      assert.equal(prevHash.toString('hex'), currentHeader.prevBlockHash)

      try {
        assert.equal(currentHeader.bits, target.bits)
        assert.equal(isGoodHash(currentHash, target.target), true)

      } catch (error) {
        var isAssertionError = error instanceof assert.AssertionError
        var interval = currentHeader.timestamp - prevHeader.timestamp
        if (!(isAssertionError && self._isTestnet && interval > 1200))
          throw error

        assert.equal(currentHeader.bits, maxBits)
        assert.equal(isGoodHash(currentHash, maxTarget), true)
      }

    } catch(error) {
      if (error instanceof assert.AssertionError)
        throw new VerifyError('Chain verification failed')

      throw error
    }
  }

  /**
   */
  function getChainLoop() {
    /*
    Q.fcall(function() {
      if (requestedHeight === null)
        return

      return self._getHeader(requestedHeight).then(function(buffer) {
        chain.unshift({ height: requestedHeight, header: bitcoin.buffer2header(buffer) })
        requestedHeight = null
      })

    }).then(function() {
      return Q.ninvoke(self._headerStorage, 'get', chain[0].height - 1).catch(function(error) {
        if (error.type !== 'NotFoundError')
          throw error

        requestedHeight = chain[0].height - 1
        throw new LoopInterrupt()
      })

    }).then(function(buffer) {
      var prevHeader = bitcoin.buffer2header(buffer)
      var prevHash = bitcoin.headerHash(buffer)

      if (prevHash.toString('hex') !== chain[0].header.prevBlockHash) {
        requestedHeight = chain[0].height - 1
        throw new LoopInterrupt()
      }

      var promise = Q()
      chain.forEach(function(data) {
        promise = promise.then(function() {
          var target = getTarget(Math.floor(data.height/2016), chain)
          var currentHash = bitcoin.headerHash(data.header)

          verifyHeader(currentHash, data.header, prevHash, prevHeader, target)

          prevHeader = data.header
          prevHash = currentHash
        })
      })

      return promise

    }).then(function() {
      return truncate(chain[0].height)

    }).then(function() {
      var data = chain.map(function(data) {
        return { height: data.height, header: bitcoin.header2buffer(data.header) }
      })
      return Q.ninvoke(self._headerStorage, 'put', data)

    }).then(function() {
      var lastPiece = chain[chain.length-1]
      self._currentBlockHash = bitcoin.headerHash(bitcoin.header2buffer(lastPiece.header))
      self.setCurrentHeight(lastPiece.height)
      deferred.resolve()

    }).catch(function(error) {
      if (error instanceof LoopInterrupt)
        getChainLoop()
      else
        deferred.reject(error)
    })
    */
  }

  /**
   */
  function getChunkLoop() {
    if (index > networkIndex)
      return deferred.resolve()

    var chunk, prevHash, prevHeader
    Q.ninvoke(self._network, 'getChunk', index).then(function(chunkHex) {
      chunk = new Buffer(chunkHex, 'hex')

      if (index > 0)
        return self._getHeader(index*2016 - 1)

      prevHash = new Buffer(32).fill(0)

    }).then(function(buffer) {
      if (Buffer.isBuffer(buffer) && buffer.length === 80) {
        prevHash = bitcoin.headerHash(buffer)
        prevHeader = bitcoin.buffer2header(buffer)
      }

      var chunkFirstHeader = bitcoin.buffer2header(chunk.slice(0, 80))
      if (chunkFirstHeader.prevBlockHash === prevHash.toString('hex'))
        return getTarget(index)

      index -= 1
      throw new LoopInterrupt()

    }).then(function(target) {
      _.range(0, chunk.length, 80).forEach(function(offset) {
        var currentHeader = bitcoin.buffer2header(chunk.slice(offset, offset+80))
        var currentHash = bitcoin.headerHash(chunk.slice(offset, offset+80))

        verifyHeader(currentHash, currentHeader, prevHash, prevHeader, target)

        prevHeader = currentHeader
        prevHash = currentHash
      })

    }).then(function() {
      self._storage.setLastHash(bitcoin.headerHash(chunk.slice(-80)))
      self._storage.truncateHeaders(0)

      if (chunk.length === 2016*80) {
        self._storage.truncateChunks(index)
        self._storage.pushChunkHash(bitcoin.crypto.hash256(chunk).toString('hex'))

      } else {
        _.range(0, chunk.length, 80).forEach(function(offset) {
          self._storage.pushHeader(chunk.slice(offset, offset+80).toString('hex'))
        })

      }

      self._currentBlockHash = self._storage.getLastHash()
      self._currentHeight = index*2016 + chunk.length/80
      self.emit('newHeight')

      index += 1
      getChunkLoop()

    }).catch(function(error) {
      if (error instanceof LoopInterrupt)
        getChunkLoop()
      else
        deferred.reject(error)
    })
  }

  if (Math.abs(self.getCurrentHeight() - networkHeight) < 50) {
    requestedHeight = networkHeight
    getChainLoop()

  } else {
    networkIndex = Math.max(Math.floor(networkHeight / 2016), 0)
    index = Math.max(Math.floor(self.getCurrentHeight() / 2016), 0)
    index = Math.min(index, networkIndex)
    getChunkLoop()

  }

  return deferred.promise
}


module.exports = VerifiedBlockchain
