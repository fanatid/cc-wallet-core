var expect = require('chai').expect

var _ = require('lodash')

var cclib = require('../src/cclib')
var AssetDefinition = require('../src/asset').AssetDefinition
var coin = require('../src/coin')
var Wallet = require('../src/index').Wallet


describe('Wallet', function() {
  var wallet
  var seed = '123131123131123131123131123131123131123131123131123131'
  var goldAsset = {
    monikers: ['gold'],
    colorDescs: ['epobc:b95323a763fa507110a89ab857af8e949810cf1e67e91104cd64222a04ccd0bb:0:180679'],
    unit: 10
  }

  beforeEach(function(done) {
    wallet = new Wallet({ testnet: true, blockchain: 'NaiveBlockchain' })
    done()
    /*
    wallet = new Wallet({ testnet: true, blockchain: 'VerifiedBlockchain' })
    wallet.getBlockchain().on('newHeight', function() {
      console.log('Blockchain newHeight:', wallet.getBlockchain().getCurrentHeight())
    })
    wallet.getBlockchain().on('error', function(error) {
      throw error
    })
    */
  })

  afterEach(function() {
    wallet.clearStorage()
  })

  describe('initialized+ methods', function() {
    it('isInitialized return false', function() {
      expect(wallet.isInitialized()).to.be.false
    })

    it('isInitialized return true', function() {
      wallet.initialize(seed)
      expect(wallet.isInitialized()).to.be.true
    })

    it('isInitializedCheck throw Error', function() {
      expect(wallet.isInitializedCheck).to.throw(Error)
    })

    it('isInitializedCheck not throw Error', function() {
      wallet.initialize(seed)
      expect(wallet.isInitializedCheck.bind(wallet)).to.not.throw(Error)
    })

    it('isCurrentSeed return true', function() {
      wallet.initialize(seed)
      expect(wallet.isCurrentSeed(seed)).to.be.true
    })

    it('isCurrentSeed return false', function() {
      wallet.initialize(seed)
      expect(wallet.isCurrentSeed(seed.split('').reverse().join(''))).to.be.false
    })
  })

  describe('asset methods', function() {
    it('addAssetDefinition need initialization', function() {
      var fn = function() { wallet.addAssetDefinition(seed, goldAsset) }
      expect(fn).to.throw(Error)
    })

    it('addAssetDefinition', function() {
      wallet.initialize(seed)
      var assetdef = wallet.addAssetDefinition(seed, goldAsset)
      expect(assetdef).to.be.instanceof(AssetDefinition)
      expect(assetdef.getData()).to.deep.equal(goldAsset)
    })

    it('getAssetDefinitionByMoniker need initialization', function() {
      var fn = function() { wallet.getAssetDefinitionByMoniker('bitcoin') }
      expect(fn).to.throw(Error)
    })

    it('getAssetDefinitionByMoniker', function() {
      wallet.initialize(seed)
      var result = wallet.getAssetDefinitionByMoniker('bitcoin')
      expect(result).to.be.instanceof(AssetDefinition)
      expect(result.getData()).to.deep.equal({ monikers: ['bitcoin'], colorDescs: [''], unit: 100000000 })
    })

    it('getAllAssetDefinitions need initialization', function() {
      var fn = function() { wallet.getAllAssetDefinitions('bitcoin') }
      expect(fn).to.throw(Error)
    })

    it('getAllAssetDefinitions', function() {
      wallet.initialize(seed)
      var result = wallet.getAllAssetDefinitions()
      expect(result).to.have.length(1)
      expect(result[0]).to.be.instanceof(AssetDefinition)
      expect(result[0].getData()).to.deep.equal({ monikers: ['bitcoin'], colorDescs: [''], unit: 100000000 })
    })
  })

  describe('address methods', function() {
    var bitcoin

    it('getNewAddress need initialization', function() {
      expect(wallet.getNewAddress).to.throw(Error)
    })

    it('getNewAddress', function() {
      wallet.initialize(seed)
      bitcoin = wallet.getAssetDefinitionByMoniker('bitcoin')
      expect(wallet.getNewAddress(seed, bitcoin)).to.equal('mmFYK2Mofiwtm68ZTYK7etjiGyf3SeLkgo')
    })

    it('getAllAddresses need initialization', function() {
      var fn = function() { wallet.getAllAddresses(bitcoin) }
      expect(fn).to.throw(Error)
    })

    it('getAllAddresses', function() {
      wallet.initialize(seed)
      expect(wallet.getAllAddresses(bitcoin)).to.deep.equal(['mmHBqwp1fDwWXaXqo5ZrEE4qAoXH5xkUvd'])
    })

    it('getSomeAddress need initialization', function() {
      var fn = function() { wallet.getSomeAddress() }
      expect(fn).to.throw(Error)
    })

    it('getSomeAddress', function() {
      wallet.initialize(seed)
      bitcoin = wallet.getAssetDefinitionByMoniker('bitcoin')
      expect(wallet.getSomeAddress(bitcoin)).to.equal('mmHBqwp1fDwWXaXqo5ZrEE4qAoXH5xkUvd')
    })

    it('checkAddress bitcoin', function() {
      wallet.initialize(seed)
      bitcoin = wallet.getAssetDefinitionByMoniker('bitcoin')
      var isValid = wallet.checkAddress(bitcoin, 'mgFmR51KZRKb2jcmJb276KQK9enC9cmG9v')
      expect(isValid).to.be.true
    })

    it('checkAddress color', function() {
      wallet.initialize(seed)
      var epobc = wallet.addAssetDefinition(seed, goldAsset)
      var isValid = wallet.checkAddress(epobc, 'ES5wsZmWHs5xzP@mgFmR51KZRKb2jcmJb276KQK9enC9cmG9v')
      expect(isValid).to.be.true
    })
  })

  describe('balance methods', function() {
    beforeEach(function(done) {
      wallet.initialize(seed)
      wallet.addAssetDefinition(seed, goldAsset)
      wallet.subscribeAndSyncAllAddresses(function(error) {
        if (error) throw error
        expect(error).to.be.null
        done()
      })
    })

    var fixtures = [
      { method: 'getAvailableBalance',   moniker: 'bitcoin', balance: 63326039 },
      { method: 'getAvailableBalance',   moniker: 'gold',    balance: 2000 },
      { method: 'getTotalBalance',       moniker: 'bitcoin', balance: 63326039 },
      { method: 'getTotalBalance',       moniker: 'gold',    balance: 2000 },
      { method: 'getUnconfirmedBalance', moniker: 'bitcoin', balance: 0 },
      { method: 'getUnconfirmedBalance', moniker: 'gold',    balance: 0 },
    ]

    fixtures.forEach(function(fixture) {
      it(fixture.method + ' for ' + fixture.moniker, function(done) {
        var assetdef = wallet.getAssetDefinitionByMoniker(fixture.moniker)
        wallet[fixture.method](assetdef, function(error, balance) {
          if (error) throw error
          expect(error).to.be.null
          expect(balance).to.equal(fixture.balance)
          done()
        })
      })
    })
  })

  describe('send, history, issue', function() {
    it('sendCoins', function(done) {
      this.timeout(120000)

      var seed = '421fc385fdae762b346b80e0212f77bb'
      wallet.initialize(seed)
      wallet.addAssetDefinition(seed, goldAsset)
      wallet.subscribeAndSyncAllAddresses(function(error) {
        expect(error).to.be.null

        var bitcoin = wallet.getAssetDefinitionByMoniker('bitcoin')
        var targets = [{ address: 'mo8Ni5kFSxcuEVXbfBaSaDzMiq1j4E6wUE', value: 10000 }]

        wallet.createTx(bitcoin, targets, function(error, tx) {
          expect(error).to.be.null

          wallet.transformTx(tx, 'signed', seed, function(error, tx) {
            expect(error).to.be.null

            wallet.sendTx(tx, function(error) {
              expect(error).to.be.null
              done()
            })
          })
        })
      })
    })

    // Need new issued asset, this broken
    it.skip('sendCoins epobc', function(done) {
      wallet = new Wallet({ masterKey: '421fc385fdae762b346b80e0212f77bd', testnet: true })
      var data = {
        monikers: ['gold'],
        colorDescs: ['epobc:b77b5d214b2f9fd23b377cbbf443a9da445fd7c6c24ba1b92d3a3bfdf26aabf2:0:273921'],
        unit: 10000
      }
      var assetdef = wallet.addAssetDefinition(data)

      wallet.subscribeAndSyncAllAddresses(function(error) {
        expect(error).to.be.null

        var address = wallet.getSomeAddress(assetdef)
        //console.log('Address to:   ' + 'mo8Ni5kFSxcuEVXbfBaSaDzMiq1j4E6wUE')
        var targets = [{ address: 'mo8Ni5kFSxcuEVXbfBaSaDzMiq1j4E6wUE', value: 10000 }]
        //wallet.getAvailableBalance(assetdef, function(error, balance) {
          //console.log(error, balance, assetdef.formatValue(balance))
        wallet.sendCoins(assetdef, targets, function(error, txId) {
          expect(error).to.be.null
          expect(txId).to.be.an('string').with.to.have.length(64)
          done()
        })
      })
    })

    it('history', function(done) {
      wallet.initialize(seed)
      wallet.subscribeAndSyncAllAddresses(function(error) {
        expect(error).to.be.null
        wallet.getHistory(function(error, entries) {
          expect(error).to.be.null
          expect(entries).to.be.instanceof(Array)
          done()
        })
      })
    })

    it('issueCoins epobc', function(done) {
      var seed = '421fc385fdaed1121221222eddad0dae'
      wallet.initialize(seed)
      wallet.addAssetDefinition(seed, goldAsset)
      wallet.subscribeAndSyncAllAddresses(function(error) {
        expect(error).to.be.null

        wallet.createIssuanceTx('newEPOBC', 'epobc', 5, 10000, seed, function(error, tx) {
          expect(error).to.be.null

          wallet.transformTx(tx, 'signed', seed, function(error, tx) {
            expect(error).to.be.null

            wallet.sendTx(tx, function(error) {
              expect(error).to.be.null
              done()
            })
          })
        })
      })
    })
  })
})
