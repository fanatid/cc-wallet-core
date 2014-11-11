var Wallet = require('../src/index').Wallet


describe('tx.TxFetcher', function() {
  var wallet, txFetcher, addresses

  beforeEach(function() {
    wallet = new Wallet({ testnet: true, blockchain: 'NaiveBlockchain' })
    wallet.initialize('123131123131123131123131123131123131123131123131123131')

    txFetcher = wallet.getTxFetcher()
    addresses = wallet.getAllAddresses(wallet.getAssetDefinitionByMoniker('bitcoin'))
  })

  afterEach(function() {
    wallet.clearStorage()
  })
})
