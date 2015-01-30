var expect = require('chai').expect
var _ = require('lodash')
var Q = require('q')

var cccore = require('../src')
var Wallet = cccore.Wallet


describe('util', function () {
  it('createCoins', function (done) {
    var goldAsset = {
      monikers: ['gold'],
      colorDescs: ['epobc:b95323a763fa507110a89ab857af8e949810cf1e67e91104cd64222a04ccd0bb:0:180679'],
      unit: 10
    }
    var seed = '421fc38522ae724b246b80e0212f77bb'
    var wallet
    var assetdef
    var coinValue = Math.floor(Math.random() * 10000 + 10000)

    Q.fcall(function () {
      localStorage.clear()
      wallet = new Wallet({
        testnet: true,
        blockchain: 'Naive',
        spendUnconfirmedCoins: true,
        systemAssetDefinitions: [goldAsset]
      })
      wallet.initialize(seed)
      assetdef = wallet.getAssetDefinitionByMoniker('bitcoin')
      return Q.ninvoke(wallet, 'subscribeAndSyncAllAddresses')

    }).then(function () {
      var opts = {
        assetdef: assetdef,
        count: 3,
        coinValue: coinValue,
        seed: seed
      }
      return Q.nfcall(cccore.util.createCoins, wallet, opts)

    }).then(function () {
      var coinQuery = wallet.getCoinQuery()
      coinQuery = coinQuery.includeUnconfirmed()
      coinQuery = coinQuery.onlyColoredAs(assetdef.getColorDefinitions())
      return Q.ninvoke(coinQuery, 'getCoins')

    }).then(function (coinList) {
      var matched = _.chain(coinList.getCoins())
        .invoke('toRawCoin')
        .pluck('value')
        .filter(function (value) { return value === coinValue })
        .size()
        .value()

      expect(matched).to.be.equal(3)

    }).finally(function () {
      wallet.removeListeners()
      wallet.clearStorage()

    }).done(done, done)
  })
})
