var Wallet = require('../src/index').Wallet


describe('tx.TxFetcher', function () {
  var wallet
  var txFetcher
  var addresses

  beforeEach(function () {
    wallet = new Wallet({
      testnet: true,
      blockchain: 'NaiveBlockchain',
      storageSaveTimeout: 0,
      spendUnconfirmedCoins: true
    })
    wallet.initialize('123131123131123131123131123131123131123131123131123131')

    txFetcher = wallet.getTxFetcher()
    addresses = wallet.getAllAddresses(wallet.getAssetDefinitionByMoniker('bitcoin'))
  })

  afterEach(function () {
    wallet.removeListeners()
    wallet.clearStorage()
  })
})
