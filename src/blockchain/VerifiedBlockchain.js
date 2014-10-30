var assert = require('assert')
var events = require('events')
var inherits = require('util').inherits

var BigInteger = require('bigi')
var createError = require('errno').create
var _ = require('lodash')
var Q = require('q')
var bufferEqual = require('buffer-equal')
var zfill = require('zfill')

var HeaderStorage = require('./HeaderStorage')

var bitcoin = require('../bitcoin')
var verify = require('../verify')


var LoopInterrupt = createError('LoopInterrupt')
var VerifyError = createError('VerifyError')


/**
 * @event VerifiedBlockchain#error
 * @type {Error} error
 */

/**
 * @event VerifiedBlockchain#newHeight
 */

/**
 * @class VerifiedBlockchain
 * @param {Wallet} wallet
 */
function VerifiedBlockchain(wallet) {
  verify.Wallet(wallet)

  events.EventEmitter.call(this)

  var self = this

  self._wallet = wallet

  self._currentHeight = -1
  self._currentBlockHash = new Buffer(32).fill(0)
  self._headerStorage = new HeaderStorage()

  Q.ninvoke(self._headerStorage, 'open').then(function() {
    return Q.ninvoke(self._headerStorage, 'count')

  }).then(function(headerCount) {
    if (headerCount !== 0)
      return Q.ninvoke(self._headerStorage, 'get', headerCount-1).then(function(lastHeader) {
        self._currentBlockHash = bitcoin.headerHash(lastHeader)
        self._currentHeight = headerCount
      })

  }).then(function() {
    var running = false
    var queue = []
    function onNetworkNewHeight() {
      var promise = Q()

      if (running) {
        queue.push(Q.defer())
        promise = queue[queue.length - 1].promise
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

    self._wallet.getNetwork().on('newHeight', onNetworkNewHeight)
    onNetworkNewHeight()

  }).catch(function(error) { self.emit('error', error) })
}

inherits(VerifiedBlockchain, events.EventEmitter)

/**
 * @param {number} newHeight
 */
VerifiedBlockchain.prototype.setCurrentHeight = function(newHeight) {
  verify.number(newHeight)

  this._currentHeight = newHeight
  this.emit('newHeight')
}

/**
 * @return {number}
 */
VerifiedBlockchain.prototype.getCurrentHeight = function() {
  return this._currentHeight
}

/**
 * @return {number}
 */
VerifiedBlockchain.prototype.getNetworkHeight = function() {
  return this._wallet.getNetwork().getCurrentHeight()
}

/**
 * @return {Buffer}
 */
VerifiedBlockchain.prototype.getCurrentBlockHash = function() {
  return this._currentBlockHash
}

/**
 * @return {Buffer}
 */
VerifiedBlockchain.prototype.getNetworkBlockHash = function() {
  return this._wallet.getNetwork().getCurrentBlockHash()
}

/**
 * @return {Q.Promise}
 */
VerifiedBlockchain.prototype._sync = function() {
  var deferred = Q.defer()

  var self = this

  if (bufferEqual(self.getCurrentBlockHash(), self.getNetworkBlockHash()))
    return deferred.resolve()

  var maxBits = 0x1d00ffff
  var maxTarget = new Buffer('00000000FFFF0000000000000000000000000000000000000000000000000000', 'hex')
  var maxTargetBI = BigInteger.fromHex(maxTarget.toString('hex'))
  var isTestnet = self._wallet.getBitcoinNetwork() === bitcoin.networks.testnet
  var requestedHeight = null, chain = []
  var networkIndex, index

  /**
   * @param {number} height
   * @return {Q.Promise}
   */
  function truncate(height) {
    var heights = []
    while (height < self.getCurrentHeight())
      heights.push(height++)
    return Q.ninvoke(self._headerStorage, 'del', heights)
  }

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
    return Q.ninvoke(self._headerStorage, 'get', (index-1)*2016).then(function(buffer) {
      firstHeader = bitcoin.buffer2header(buffer)

    }).then(function() {
      return Q.ninvoke(self._headerStorage, 'get', index*2016-1).then(function(buffer) {
        lastHeader = bitcoin.buffer2header(buffer)

      }).catch(function(error) {
        if (error.type !== 'NotFoundError')
          throw error

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
        if (!(isAssertionError && isTestnet && interval > 1200))
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
    Q.fcall(function() {
      if (requestedHeight === null)
        return

      return Q.ninvoke(self._wallet.getNetwork(), 'getHeader', requestedHeight).then(function(header) {
        chain.unshift({ height: requestedHeight, header: header })
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
  }

  /**
   */
  function getChunkLoop() {
    if (index > networkIndex)
      return deferred.resolve()

    var chunk, prevHash, prevHeader
    Q.ninvoke(self._wallet.getNetwork(), 'getChunk', index).then(function(chunkHex) {
      chunk = new Buffer(chunkHex, 'hex')

      // NotFoundError handler?
      if (index > 0)
        return Q.ninvoke(self._headerStorage, 'get', index*2016 - 1)

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
      _.range(chunk.length/80).forEach(function(i) {
        var currentHeader = bitcoin.buffer2header(chunk.slice(i*80, (i+1)*80))
        var currentHash = bitcoin.headerHash(chunk.slice(i*80, (i+1)*80))

        verifyHeader(currentHash, currentHeader, prevHash, prevHeader, target)

        prevHeader = currentHeader
        prevHash = currentHash
      })

    }).then(function() {
      return truncate(index*2016)

    }).then(function() {
      var data = []
      _.range(chunk.length/80).forEach(function(i) {
        data.push({ height: index*2016 + i, header: chunk.slice(i*80, (i+1)*80) })
      })
      return Q.ninvoke(self._headerStorage, 'put', data)

    }).then(function() {
      self._currentBlockHash = bitcoin.headerHash(chunk.slice(-80))
      self.setCurrentHeight(index*2016 + chunk.length/80)
      index += 1
      getChunkLoop()

    }).catch(function(error) {
      if (error instanceof LoopInterrupt)
        getChunkLoop()
      else
        deferred.reject(error)
    })
  }

  if (Math.abs(self.getCurrentHeight() - self.getNetworkHeight()) < 50) {
    requestedHeight = self.getNetworkHeight()
    getChainLoop()

  } else {
    networkIndex = Math.max(Math.floor(self.getNetworkHeight() / 2016), 0)
    index = Math.max(Math.floor(self.getCurrentHeight() / 2016), 0)
    index = Math.min(index, networkIndex)
    getChunkLoop()

  }

  return deferred.promise
}


module.exports = VerifiedBlockchain
