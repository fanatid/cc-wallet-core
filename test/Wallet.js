var expect = require('chai').expect
var Q = require('q')
var bitcore = require('bitcore-lib')

var cccore = require('../src')
var errors = cccore.errors
var AssetDefinition = cccore.asset.AssetDefinition
var Wallet = cccore.Wallet

describe('Wallet', function () {
  this.timeout(240 * 1000)

  var wallet
  var seed = '123131123131123131123131123131123131123131123131123131'
  var goldAsset = {
    monikers: ['gold'],
    colorDescs: ['epobc:b95323a763fa507110a89ab857af8e949810cf1e67e91104cd64222a04ccd0bb:0:180679'],
    unit: 10
  }
  var goldAssetZero = {
    monikers: ['gold'],
    colorDescs: ['epobc:b95323a763fa507110a89ab857af8e949810cf1e67e91104cd64222a04ccd0bb:0:0'],
    unit: 10
  }

  function setup (done) {
    wallet = new Wallet({
      testnet: true,
      blockchain: {name: 'Verified'},
      spendUnconfirmedCoins: true
    })
    wallet.getConnector().once('connect', done)
    wallet.on('error', function (err) { console.error(err.stack) })
  }

  function cleanup () {
    wallet.disconnect()
    wallet.removeListeners()
    wallet.clearStorage()
    wallet = null
  }

  describe('instance methods', function () {
    beforeEach(setup)
    afterEach(cleanup)

    describe('initialized+ methods', function () {
      it('isInitialized return false', function () {
        expect(wallet.isInitialized()).to.be.false
      })

      it('isInitialized return true', function () {
        wallet.initialize(seed)
        expect(wallet.isInitialized()).to.be.true
      })

      it('isInitializedCheck throw Error', function () {
        expect(wallet.isInitializedCheck.bind(wallet)).to.throw(errors.WalletNotInitializedError)
      })

      it('isInitializedCheck not throw Error', function () {
        wallet.initialize(seed)
        expect(wallet.isInitializedCheck.bind(wallet)).to.not.throw(errors.WalletAlreadyInitializedError)
      })

      it('isCurrentSeed return true', function () {
        wallet.initialize(seed)
        expect(wallet.isCurrentSeed(seed)).to.be.true
      })

      it('isCurrentSeed return false', function () {
        wallet.initialize(seed)
        expect(wallet.isCurrentSeed(seed.split('').reverse().join(''))).to.be.false
      })
    })

    describe('asset methods', function () {
      it('addAssetDefinition need initialization', function () {
        var fn = function () { wallet.addAssetDefinition(seed, goldAsset) }
        expect(fn).to.throw(errors.WalletNotInitializedError)
      })

      it('addAssetDefinition', function () {
        wallet.initialize(seed)
        var assetdef = wallet.addAssetDefinition(seed, goldAsset)
        expect(assetdef).to.be.instanceof(AssetDefinition)
        expect(assetdef.getData()).to.deep.equal(goldAssetZero)
      })

      it('getAssetDefinitionByMoniker need initialization', function () {
        var fn = function () { wallet.getAssetDefinitionByMoniker('bitcoin') }
        expect(fn).to.throw(errors.WalletNotInitializedError)
      })

      it('getAssetDefinitionByMoniker', function () {
        wallet.initialize(seed)
        var result = wallet.getAssetDefinitionByMoniker('bitcoin')
        expect(result).to.be.instanceof(AssetDefinition)
        expect(result.getData()).to.deep.equal({monikers: ['bitcoin'], colorDescs: [''], unit: 100000000})
      })

      it('getAllAssetDefinitions need initialization', function () {
        var fn = function () { wallet.getAllAssetDefinitions('bitcoin') }
        expect(fn).to.throw(errors.WalletNotInitializedError)
      })

      it('getAllAssetDefinitions', function () {
        wallet.initialize(seed)
        var result = wallet.getAllAssetDefinitions()
        expect(result).to.have.length(1)
        expect(result[0]).to.be.instanceof(AssetDefinition)
        expect(result[0].getData()).to.deep.equal({monikers: ['bitcoin'], colorDescs: [''], unit: 100000000})
      })
    })

    describe('address methods', function () {
      var adef

      it('getNewAddress need initialization', function () {
        expect(wallet.getNewAddress.bind(wallet)).to.throw(errors.WalletNotInitializedError)
      })

      it('getNewAddress', function () {
        wallet.initialize(seed)
        adef = wallet.getAssetDefinitionByMoniker('bitcoin')
        expect(wallet.getNewAddress(seed, adef)).to.equal('mmFYK2Mofiwtm68ZTYK7etjiGyf3SeLkgo')
      })

      it('getAllAddresses need initialization', function () {
        var fn = function () { wallet.getAllAddresses(adef) }
        expect(fn).to.throw(errors.WalletNotInitializedError)
      })

      it('getAllAddresses', function () {
        wallet.initialize(seed)
        expect(wallet.getAllAddresses(adef)).to.deep.equal(['mmHBqwp1fDwWXaXqo5ZrEE4qAoXH5xkUvd'])
      })

      it('getSomeAddress need initialization', function () {
        var fn = function () { wallet.getSomeAddress() }
        expect(fn).to.throw(errors.WalletNotInitializedError)
      })

      it('getSomeAddress', function () {
        wallet.initialize(seed)
        adef = wallet.getAssetDefinitionByMoniker('bitcoin')
        expect(wallet.getSomeAddress(adef)).to.equal('mmHBqwp1fDwWXaXqo5ZrEE4qAoXH5xkUvd')
      })

      it('checkAddress bitcoin', function () {
        wallet.initialize(seed)
        adef = wallet.getAssetDefinitionByMoniker('bitcoin')
        var isValid = wallet.checkAddress(adef, 'mgFmR51KZRKb2jcmJb276KQK9enC9cmG9v')
        expect(isValid).to.be.true
      })

      it('checkAddress color', function () {
        wallet.initialize(seed)
        var epobc = wallet.addAssetDefinition(seed, goldAsset)
        var isValid = wallet.checkAddress(epobc, 'ES5wsZmWHs5xzP@mgFmR51KZRKb2jcmJb276KQK9enC9cmG9v')
        expect(isValid).to.be.true
      })
    })
  })

  describe('balance methods', function () {
    before(function (done) {
      setup(function () {
        wallet.initialize(seed)
        wallet.addAssetDefinition(seed, goldAsset)
        wallet.once('syncStop', done)
      })
    })

    after(cleanup)

    var fixtures = [
      {method: 'getAvailableBalance', moniker: 'bitcoin', balance: 63326039},
      {method: 'getAvailableBalance', moniker: 'gold', balance: 2000},
      {method: 'getTotalBalance', moniker: 'bitcoin', balance: 63326039},
      {method: 'getTotalBalance', moniker: 'gold', balance: 2000},
      {method: 'getUnconfirmedBalance', moniker: 'bitcoin', balance: 0},
      {method: 'getUnconfirmedBalance', moniker: 'gold', balance: 0}
    ]

    fixtures.forEach(function (fixture) {
      it(fixture.method + ' for ' + fixture.moniker, function () {
        var assetdef = wallet.getAssetDefinitionByMoniker(fixture.moniker)

        return Q.ninvoke(wallet, fixture.method, assetdef)
          .then(function (balance) {
            expect(balance).to.equal(fixture.balance)
          })
      })
    })
  })

  describe('send, history, issue', function () {
    beforeEach(setup)
    afterEach(cleanup)

    it('sendCoins', function () {
      var seed = '421fc385fdae724b246b80e0212f77bc'
      wallet.initialize(seed)

      return new Q.Promise(function (resolve) {
        wallet.once('syncStop', resolve)
      })
      .then(function () {
        var bitcoin = wallet.getAssetDefinitionByMoniker('bitcoin')
        var randomAddress = bitcore.PrivateKey.fromRandom(bitcore.Networks.testnet).toAddress().toString()
        var targets = [{address: randomAddress, value: 10000}]
        return Q.ninvoke(wallet, 'createTx', bitcoin, targets)
      })
      .then(function (tx) {
        return Q.ninvoke(wallet, 'transformTx', tx, 'signed', {seedHex: seed})
      })
      .then(function (tx) {
        return new Q.Promise(function (resolve, reject) {
          wallet.on('updateTx', function (newTx) {
            if (newTx.id === tx.id) {
              resolve()
            }
          })

          Q.ninvoke(wallet, 'sendTx', tx).catch(reject)
        })
      })
    })

    it('history', function (done) {
      wallet.initialize(seed)
      wallet.addAssetDefinition(seed, goldAsset)

      wallet.on('syncStop', function () {
        try {
          var entries = wallet.getHistory()
          expect(entries).to.be.instanceof(Array)
          done()
        } catch (err) {
          done(err)
        }
      })
    })

    it('issueCoins epobc', function () {
      var seed = '421ac385fdaed1121321222eddad0dbf'
      wallet.initialize(seed)
      wallet.addAssetDefinition(seed, goldAsset)

      return new Q.Promise(function (resolve) {
        wallet.once('syncStop', resolve)
      })
      .then(function () {
        return Q.ninvoke(wallet, 'createIssuanceTx', 'newEPOBC', 'epobc', 2, 10000, seed)
      })
      .then(function (tx) {
        return Q.ninvoke(wallet, 'transformTx', tx, 'signed', {seedHex: seed})
      })
      .then(function (tx) {
        return Q.ninvoke(wallet, 'sendTx', tx)
      })
    })
  })
})
