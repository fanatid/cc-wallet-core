var expect = require('chai').expect

/*
var blockchain = require('../src/blockchain')

var helpers = require('./helpers')


describe('blockchain.BlockrIo', function() {
  var bs

  beforeEach(function() {
    bs = new blockchain.BlockrIo()
  })

  it('inherits BlockchainBase', function() {
    expect(bs).to.be.instanceof(blockchain.BlockchainBase)
    expect(bs).to.be.instanceof(blockchain.BlockrIo)
  })

  describe('request', function() {
    it('timeout', function(done) {
      bs = new blockchain.BlockrIo({ requestTimeout: 10 })
      bs.getBlockCount(function(error, response) {
        expect(error).to.be.instanceof(Error)
        expect(response).to.be.undefined
        done()
      })
    })
  })

  describe('getBlockCount', function() {
    it('return block count', function(done) {
      bs.getBlockCount(function(error, response) {
        expect(error).to.be.null
        expect(response).to.be.a('number')
        expect(response).to.be.at.least(0)
        done()
      })
    })
  })

  describe('getTx', function() {
    it('from mainnet', function(done) {
      bs.getTx('0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098', function(error, tx) {
        expect(error).to.be.null
        expect(tx.toHex()).to.equal('\
01000000010000000000000000000000000000000000000000000000000000000000000000fffff\
fff0704ffff001d0104ffffffff0100f2052a0100000043410496b538e853519c726a2c91e61ec1\
1600ae1390813a627c66fb8be7947be63c52da7589379515d4e0a604f8141781e62294721166bf6\
21e73a82cbf2342c858eeac00000000')
        done()
      })
    })

    it('from testnet', function(done) {
      bs = new blockchain.BlockrIo({ testnet: true })
      bs.getTx('f0315ffc38709d70ad5647e22048358dd3745f3ce3874223c80a7c92fab0c8ba', function(error, tx) {
        expect(error).to.be.null
        expect(tx.toHex()).to.equal('\
01000000010000000000000000000000000000000000000000000000000000000000000000fffff\
fff0e0420e7494d017f062f503253482fffffffff0100f2052a010000002321021aeaf2f8638a12\
9a3156fbe7e5ef635226b0bafd495ff03afe2c843d7e3a4b51ac00000000')
        done()
      })
    })
  })

  describe('getTxBlockHash', function() {
    it('return null for unconfirmed tx', function(done) {
      bs = new blockchain.BlockrIo({ testnet: true })
      helpers.sendCoins(bs, function(txId) {
        // timeout for transaction propagation
        setTimeout(function() {
          bs.getTxBlockHash(txId, function(error, response) {
            expect(error).to.be.null
            expect(response).to.be.null
            done()
          })
        }, 15*1000)
      })
    })

    it('return blockhash', function(done) {
      bs.getTxBlockHash('0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098', function(error, response) {
        expect(error).to.be.null
        expect(response).to.equal('00000000839a8e6886ab5951d76f411475428afc90947ee320161bbf18eb6048')
        done()
      })
    })
  })

  describe('getBlockHeight', function() {
    it('return block height', function(done) {
      bs.getBlockHeight('00000000839a8e6886ab5951d76f411475428afc90947ee320161bbf18eb6048', function(error, response) {
        expect(error).to.be.null
        expect(response).to.equal(1)
        done()
      })
    })
  })

  describe('getBlockTime', function() {
    it('return block time', function(done) {
      bs.getBlockTime('0000000000000000041af0c6d8156cac373dc62fded618ab9d255a926887b88a', function(error, response) {
        expect(error).to.be.null
        expect(response).to.equal(1408730727)
        done()
      })
    })
  })

  describe('sendTx', function() {
    it('send coins', function(done) {
      bs = new blockchain.BlockrIo({ testnet: true })
      helpers.sendCoins(bs, function() { done() })
    })
  })

  describe('getUTXO', function() {
    it('right amount from mainnet', function(done) {
      bs.getUTXO('198aMn6ZYAczwrE5NvNTUMyJ5qkfy4g3Hi', function(error, response) {
        expect(error).to.be.null
        var values = response.map(function(utxo) { return utxo.value })
        var totalValue = values.reduce(function(acc, current) { return acc + current }, 0)
        expect(totalValue).to.equal(800000033346)
        done()
      })
    })
  })

  describe('getHistory', function() {
    it('list from mainnet', function(done) {
      bs.getHistory('1BjQwkBPE1cbpQCY4u2nt7D6cFvJscwPJg', function(error, response) {
        expect(error).to.be.null
        expect(response[0].txId).to.equal('2e251defb56108a6c7def2fc6937d113435e7d39e1d518ca0a4ab66fa38d098b')
        expect(response[0].confirmations).to.be.at.least(0)
        expect(response[1].txId).to.equal('77e491c32ec4cd877a26a2d445f28eaa34df51c9c45c1f27c2aea6e7544ec01e')
        expect(response[1].confirmations).to.be.at.least(0)
        done()
      })
    })
  })
})
*/
