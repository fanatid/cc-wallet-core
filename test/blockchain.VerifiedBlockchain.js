var expect = require('chai').expect

var bitcoin = require('../src/bitcoin')
var Wallet = require('../src').Wallet


describe('blockchain.VerifiedBlockchain', function() {
  var wallet

  beforeEach(function() {
    wallet = new Wallet({ testnet: true, storageSaveTimeout: 0 })
  })

  afterEach(function() {
    wallet.removeListeners()
    wallet.clearStorage()
  })

  it('wait verify tx', function(done) {
    this.timeout(60000)

    wallet.getBlockchain().on('error', function(error) {
      console.error(error.stack)
    })

    var txId = '30aa4a6efa4b692f1d879bfd15cd2da12d39b9413bf9e718251fb3e1d0136725'
    wallet.getBlockchain().getTx(txId, function(error, result) {
      expect(error).to.be.null
      expect(result).to.be.instanceof(bitcoin.Transaction)
      expect(result.getId()).to.equal(txId)
      done()
    })
  })
})
