var expect = require('chai').expect

var Network = require('../src').network.Network
var Electrum = require('../src').network.Electrum

var helpers = require('./helpers')


describe('network.Electrum', function() {
  var network

  beforeEach(function(done) {
    network = new Electrum({ url: 'ws://devel.hz.udoidio.info:8784/' })
    network.once('connect', done)
  })

  it('inherits Network', function() {
    expect(network).to.be.instanceof(Network)
    expect(network).to.be.instanceof(Electrum)
  })

  it('wait newHeight event', function(done) {
    network.once('newHeight', function() {
      var currentHeight = network.getCurrentHeight()
      expect(currentHeight).to.be.at.least(0)
      done()
    })
  })

  it('address subscribe', function(done) {
    network.subscribeAddress('ms8XQE6MHsreo9ZJx1vXqQVgzi84xb9FRZ', function(error) {
      expect(error).to.be.null
      done()
    })
  })

  it('getHeader', function(done) {
    network.getHeader(0, function(error, header) {
      expect(error).to.be.null
      expect(header).to.deep.equal({
        version: 1,
        prevBlockHash: null,
        merkleRoot: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
        timestamp: 1296688602,
        bits: 486604799,
        nonce: 414098458
      })
      done()
    })
  })

  it('getChunk', function(done) {
    network.getChunk(0, function(error, chunk) {
      expect(error).to.be.null
      expect(chunk).to.have.length(160*2016)
      done()
    })
  })

  it('getTx', function(done) {
    var txId = '9854bf4761024a1075ebede93d968ce1ba98d240ba282fb1f0170e555d8fdbd8'

    network.getTx(txId, function(error, tx) {
      expect(error).to.be.null
      expect(tx.getId()).to.equal(txId)
      done()
    })
  })

  it('getMerkle', function(done) {
    var txId = '9854bf4761024a1075ebede93d968ce1ba98d240ba282fb1f0170e555d8fdbd8'
    var blockHeight = 279774

    network.getMerkle(txId, blockHeight, function(error, result) {
      expect(error).to.be.null
      expect(result).to.deep.equal({
        merkle: [
          '289eb5dab9aad256a7f508377f8cec7df4c3eae07572a8d7273e303a81313e03',
          'b8a668d25ff4c5cf7f5f7fcdf504b695b87768a217fd131645b8712cbef56ebc',
          'c3fe05147e431270966a1f11e2ddab4b6d7ab3f848c651f455ead409bd8ed28f',
          'bdc4c6d8dfd51012d14e8f05bdb4d41de125abe98716afa162ba3203ab662b76',
          '3312f4e797842662e9312e1dc8dcb2ea67e71bacc75452bb3f334d106f59fb33',
          'ee4fa69f14997438d21fc3227b0f52f7d5fd074db00f159f5ac880ddc0559446'
        ],
        index: 4
      })
      done()
    })
  })

  it('sendTx', function(done) {
    helpers.sendCoins(network, function() { done() })
  })

  it('getHistory', function(done) {
    var address = 'miASVwyhoeFqoLodXUdbDC5YjrdJPwxyXE'

    network.getHistory(address, function(error, result) {
      expect(error).to.be.null
      expect(result).to.deep.equal([
        {
          txId: '1bd6a31671e9cc767d75980d4dbffc5cd5029f17d44dd32dcf949267e3f04631',
          height: 12740
        },
        {
          txId: '9ea76cd53be261b320d8479d432aad98c61aa5945416d85ab15bed62030ce6e4',
          height: 16349
        }
      ])
      done()
    })
  })

  it('getUnspent', function(done) {
    var address = 'mn675cxzUzM8hyd7TYApCvGBhQ8v69kgGb'

    network.getUnspent(address, function(error, result) {
      expect(error).to.be.null
      expect(result).to.deep.equal([
        {
          txId: 'd56e75eedb9e9e49a8ae81c3d4781312c4d343bea811219d3eb4184ae6b34639',
          index: 0,
          value: 5025150000,
          height: 103546
        },
        {
          txId: '548be1cc68780cbe0ce7e4b46c06dbe38ecd509a3f448e5ca68cc294679c27b1',
          index: 0,
          value: 5025050000,
          height: 103548
        }
      ])
      done()
    })
  })
})
