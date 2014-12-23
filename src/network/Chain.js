var inherits = require('util').inherits

var _ = require('lodash')
var Q = require('q')
var request = require('request')
var WebSockets = require('ws')

var bitcoin = require('../bitcoin')
var errors = require('../errors')
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
    requestTimeout: 10 * 1000,
    refreshInterval: 30 * 1000
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

  function initNotify() {
    self._ws = new WebSockets('wss://ws.chain.com/v2/notifications')

    self._ws.onopen = function () {
      self._attemptCount = 0
      self.emit('connect')
    }

    self._ws.onclose = function () {
      attemptInitNotify()
      self.emit('disconnect')
    }

    self._ws.onerror = function (error) {
      if (!self.isConnected()) {
        attemptInitNotify()
      }
      self.emit('error', error)
    }

    self._ws.onmessage = function (message) {
      try {
        var payload = JSON.parse(message.data).payload

        if (payload.type === 'new-block') {
          verify.number(payload.block.height)
          return self._setCurrentHeight(payload.block.height).catch(function (error) {
            self.emit('error', error)
          })
        }

        if (payload.type === 'address') {
          verify.number(payload.confirmations)
          if (payload.confirmations < 2) {
            return
          }

          verify.string(payload.address)
          return self.emit('touchAddress', payload.address)
        }

      } catch (error) {
        self.emit('error', error)

      }
    }
  }

  self._attemptCount = 0
  function attemptInitNotify() {
    setTimeout(initNotify, 15000 * Math.pow(2, self._attemptCount))
    self._attemptCount += 1
  }


  self._subscribedAddressesQueue = {}
  self._subscribedAddresses = {}

  self.on('connect', function () {
    var req = {type: 'new-block', block_chain: self._blockChain}
    self._ws.send(JSON.stringify(req))

    self._request('/blocks/latest').then(function (response) {
      if (self.getCurrentHeight() !== response.height) {
        return Q.ninvoke(self, '_setCurrentHeight', response.height)
      }

    }).catch(function (error) {
      self.emit('error', error)

    }).done()

    _.keys(self._subscribedAddressesQueue).forEach(function (address) {
      self.subscribeAddress(address)
    })
    self._subscribedAddressesQueue = {}
  })


  initNotify()
}

inherits(Chain, Network)

/**
 * @param {string} path
 * @return {string}
 */
Chain.prototype._getRequestURL = function (path) {
  verify.string(path)
  return 'https://api.chain.com/v2/' + this._blockChain + path + '?api-key-id=' + this._apiKeyId
}

/**
 * @param {string} path
 * @param {Object} [data] Data for POST request, may be missed
 * @return {Q.Promise<string>}
 */
Chain.prototype._request = function (path, data) {
  var requestOpts = {
    method: _.isUndefined(data) ? 'GET' : 'POST',
    uri: this._getRequestURL(path),
    body: JSON.stringify(data),
    timeout: this._requestTimeout,
    zip: true,
    json: true
  }

  return Q.nfcall(request, requestOpts).spread(function (response, body) {
    if (response.statusCode === 200) {
      return body
    }

    throw new errors.NetworkChainError(response.statusMessage)
  })
}

/**
 * {@link Network~getHeader}
 */
Chain.prototype.getHeader = function (height) {
  verify.number(height)

  return this._request('/blocks/' + height).then(function (response) {
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
      timestamp: Date.parse(response.time) / 1000,
      bits: parseInt(response.bits, 16),
      nonce: response.nonce
    }

  })
}

/**
 * {@link Network~getTx}
 */
Chain.prototype.getTx = function (txId, walletState) {
  verify.txId(txId)
  if (!_.isUndefined(walletState)) { verify.WalletState(walletState) }

  var tx = this._wallet.getStateManager().getTx(txId, walletState)
  if (tx !== null) {
    return Q(tx)
  }

  return this._request('/transactions/' + txId + '/hex').then(function (response) {
    verify.object(response)

    var tx = bitcoin.Transaction.fromHex(response.hex)
    if (tx.getId() === txId) {
      return tx
    }

    throw new errors.NetworkGetTxError('Expected: ' + txId + ', got: ' + tx.getId())
  })
}

/**
 * {@link Network~sendTx}
 */
Chain.prototype.sendTx = function (tx) {
  verify.Transaction(tx)

  return this._request('/transactions', {'hex': tx.toHex()}).then(function (response) {
    if (response.transaction_hash === tx.getId()) {
      return response.transaction_hash
    }

    throw new errors.NetworkSendTxError('Expected: ' + tx.getId() + ', got: ' + response.transaction_hash)
  })
}

/**
 * {@link Network~getHistory}
 */
Chain.prototype.getHistory = function (address) {
  verify.string(address)

  return this._request('/addresses/' + address + '/transactions').then(function (response) {
    verify.array(response)

    var entries = response.map(function (entry) {
      verify.txId(entry.hash)
      if (entry.block_height === null) { entry.block_height = 0 }
      verify.number(entry.block_height)

      return {
        txId: entry.hash,
        height: entry.block_height
      }
    })

    return _.sortBy(entries, function (entry) {
      return entry.height === 0 ? Infinity : entry.height
    })
  })
}

/**
 * {@link Network~getHistory}
 */
Chain.prototype.getUnspent = function (address) {
  verify.string(address)

  var self = this
  var promise = Q()
  if (!self.isConnected() || self.getCurrentHeight() === -1) {
    var deferred = Q.defer()
    self.once('newHeight', deferred.resolve)
    promise = deferred.promise
  }

  return promise.then(function () {
    return self._request('/addresses/' + address + '/unspents')

  }).then(function (response) {
    verify.array(response)

    var currentHeight = self.getCurrentHeight()
    return _.chain(response)
      .map(function (entry) {
        verify.txId(entry.transaction_hash)
        verify.number(entry.output_index)
        verify.number(entry.value)
        verify.number(entry.confirmations)

        if (entry.confirmations === 0) {
          entry.confirmations = currentHeight + 1
        }

        return {
          txId: entry.transaction_hash,
          outIndex: entry.output_index,
          value: entry.value,
          height: currentHeight - entry.confirmations + 1
        }
      })
      .sortBy(function (entry) {
        return entry.height === 0 ? Infinity : entry.height
      })
      .value()
  })
}

/**
 * {@link Network~subscribeAddress}
 */
Chain.prototype.subscribeAddress = function (address) {
  verify.string(address)

  var obj = this.isConnected() ? this._subscribedAddresses : this._subscribedAddressesQueue
  if (_.isUndefined(obj[address])) {
    obj[address] = true

    if (this.isConnected()) {
      var req = {type: 'address', address: address, block_chain: this._blockChain}
      this._ws.send(JSON.stringify(req))

    } else {
      this._subscribedAddressesQueue.push(address)

    }
  }

  return Q()
}


module.exports = Chain
