var events = require('events')

var expect = require('chai').expect

var cccore = require('../src')


describe('blockchain.NaiveBlockchain', function() {
  var wallet, nb

  beforeEach(function() {
    wallet = new cccore.Wallet({ testnet: true, blockchain: 'NaiveBlockchain' })
    nb = wallet.getBlockchain()
  })

  it('inherits Blockchain', function() {
    expect(nb).to.be.instanceof(cccore.blockchain.Blockchain)
    expect(nb).to.be.instanceof(cccore.blockchain.NaiveBlockchain)
  })

  it('getCurrentHeight', function(done) {
    expect(nb.getCurrentHeight()).to.be.equal(-1)
    nb.on('newHeight', function() {
      expect(nb.getCurrentHeight()).to.at.least(300000)
      done()
    })
  })

  it('getBlockTime', function(done) {
    nb.getBlockTime(300000, function(error, timestamp) {
      expect(error).to.be.null
      expect(timestamp).to.be.a('number')
      expect(timestamp).to.equal(1412899877)
      done()
    })
  })

  it('getTx', function(done) {
    var txId = 'b850a8bccc4d8da39e8fe95396011501e1ab152a74be985af11227458a7deaea'
    var txHex = '\
0100000001ae857b1721e98bae4c139785f05f2d041d3bb872d026e09e3e6601752f72526e000000\
006a47304402201f09c10fa777266c7ca1257980b36a3e9f1b9967ba9ed59b1ada86b83961fdf702\
201b4b76b098e3e3207c1e0f3ad69da48b42fb25fa6708621eaf75df1353c4f66e012102fee381c9\
0149e22ae182156c16316c24fe680a0e617646c3d58531112ac82e29ffffffff0176f20000000000\
001976a914b96b816f378babb1fe585b7be7a2cd16eb99b3e488ac00000000'
    nb.getTx(txId, function(error, tx) {
      expect(error).to.be.null
      expect(tx.toHex()).to.equal(txHex)
      done()
    })
  })

  it.skip('sendTx', function() {})

  it('getHistory', function(done) {
    var address = 'n1YYm9uXWTsjd6xwSEiys7aezJovh6xKbj'
    nb.getHistory(address, function(error, entries) {
      expect(error).to.be.null
      expect(entries).to.deep.equal([
        {
          txId: '75a22bdb38352ba6deb7495631335616a308a2db8eb1aa596296d3be5f34f01e',
          height: 159233
        }
      ])
      done()
    })
  })

  it('subscribeAddress', function(done) {
    var address = 'mgBcotqHuxNHTN1fFeryAwxmB4uvWPy9hx'
    nb.subscribeAddress(address, function(error) {
      expect(error).to.be.null
      done()
    })
  })
})
