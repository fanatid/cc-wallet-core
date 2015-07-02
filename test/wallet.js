/* global describe, beforeEach, afterEach, it */
'use strict'

var _ = require('lodash')
var expect = require('chai').expect
var Promise = require('bluebird')
var cclib = require('coloredcoinjs-lib')

var cccore = require('../')
var Wallet = cccore.Wallet

var helpers = require('./helpers')

describe('Wallet', function () {
  this.timeout(240 * 1000)

  var wallet
  var seed = '123131123131123131123131123131123131123131123131123131'
  var goldAsset = {
    monikers: [
      'gold'
    ],
    cdescs: [
      'epobc:b95323a763fa507110a89ab857af8e949810cf1e67e91104cd64222a04ccd0bb:0:180679'
    ],
    unit: 10
  }

  beforeEach(function (done) {
    wallet = new Wallet({
      testnet: true,
      blockchain: {name: 'Naive'},
      spendUnconfirmedCoins: true
    })
    wallet.connector.once('connect', done)
    wallet.on('error', helpers.ignoreConnectorErrors)
  })

  afterEach(function (done) {
    Promise.all([
      wallet.clearStorage(),
      new Promise(function (resolve) {
        if (wallet.connector.isConnected()) {
          return resolve()
        }

        wallet.once('disconnect', resolve)
      })
    ])
    .then(function () {
      wallet.removeListeners()
      wallet = null
    })
    .done(done, done)

    wallet.disconnect()
  })

  describe('instance methods', function () {
    describe('initialized+ methods', function () {
      it('isInitialized return false', function (done) {
        wallet.isInitialized()
          .then(function (isInitialized) {
            expect(isInitialized).to.be.false
          })
          .done(done, done)
      })

      it('isInitialized return true', function (done) {
        wallet.initialize(seed)
          .then(function () {
            return wallet.isInitialized()
          })
          .then(function () {
            return wallet.isInitialized()
          })
          .then(function (isInitialized) {
            expect(isInitialized).to.be.true
          })
          .done(done, done)
      })

      it('isInitializedCheck throw Error', function (done) {
        wallet.isInitializedCheck()
          .asCallback(function (err) {
            expect(err).to.be.instanceof(Error)
            done()
          })
          .done(_.noop, _.noop)
      })

      it('isInitializedCheck not throw Error', function (done) {
        wallet.initialize(seed)
          .then(function () {
            return wallet.isInitializedCheck()
          })
          .asCallback(function (err) {
            expect(err).to.be.null
            done()
          })
          .done(_.noop, _.noop)
      })

      it('isCurrentSeed return true', function (done) {
        wallet.initialize(seed)
          .then(function () {
            return wallet.isCurrentSeed(seed)
          })
          .then(function (isCurrentSeed) {
            expect(isCurrentSeed).to.be.true
          })
          .done(done, done)
      })

      it('isCurrentSeed return false', function (done) {
        wallet.initialize(seed)
          .then(function () {
            return wallet.isCurrentSeed(new Buffer(16).toString('hex'))
          })
          .then(function (isCurrentSeed) {
            expect(isCurrentSeed).to.be.false
          })
          .done(done, done)
      })
    })

    describe('asset methods', function () {
      it('addAssetDefinition need initialization', function (done) {
        wallet.addAssetDefinition(goldAsset, seed)
          .asCallback(function (err) {
            expect(err).to.be.instanceof(Error)
            done()
          })
          .done(_.noop, _.noop)
      })

      it('addAssetDefinition', function (done) {
        wallet.initialize(seed)
          .then(function () {
            return wallet.addAssetDefinition(goldAsset, seed)
          })
          .then(function (adef) {
            expect(adef).to.be.instanceof(cccore.assets.Definition)
            var rawAsset = {
              monikers: adef.getMonikers(),
              cdescs: adef.getColorSet().getColorDescs(),
              unit: adef.getUnit()
            }
            expect(rawAsset).to.deep.equal(goldAsset)
          })
          .done(done, done)
      })

      it('getAssetDefinitionByMoniker need initialization', function (done) {
        wallet.getAssetDefinitionByMoniker('bitcoin')
          .asCallback(function (err) {
            expect(err).to.be.instanceof(Error)
            done()
          })
          .done(_.noop, _.noop)
      })

      it('getAssetDefinitionByMoniker', function (done) {
        wallet.initialize(seed)
          .then(function () {
            return wallet.getAssetDefinitionByMoniker('bitcoin')
          })
          .then(function (adef) {
            expect(adef).to.be.instanceof(cccore.assets.Definition)
            var rawAsset = {
              monikers: adef.getMonikers(),
              cdescs: adef.getColorSet().getColorDescs(),
              unit: adef.getUnit()
            }
            expect(rawAsset).to.deep.equal(
              {monikers: ['bitcoin'], cdescs: [''], unit: 100000000})
          })
          .done(done, done)
      })

      it('getAllAssetDefinitions need initialization', function (done) {
        wallet.getAllAssetDefinitions()
          .asCallback(function (err) {
            expect(err).to.be.instanceof(Error)
            done()
          })
          .done(_.noop, _.noop)
      })

      it('getAllAssetDefinitions', function (done) {
        wallet.initialize(seed)
          .then(function () {
            return wallet.getAllAssetDefinitions()
          })
          .then(function (adefs) {
            expect(adefs).to.have.length(1)
            expect(adefs[0]).to.be.instanceof(cccore.assets.Definition)
            var rawAsset = {
              monikers: adefs[0].getMonikers(),
              cdescs: adefs[0].getColorSet().getColorDescs(),
              unit: adefs[0].getUnit()
            }
            expect(rawAsset).to.deep.equal(
              {monikers: ['bitcoin'], cdescs: [''], unit: 100000000})
          })
          .done(done, done)
      })
    })

    describe('address methods', function () {
      it('getNewAddress need initialization', function (done) {
        wallet.getNewAddress(cclib.definitions.Uncolored, seed)
          .asCallback(function (err) {
            expect(err).to.be.instanceof(Error)
            done()
          })
          .done(_.noop, _.noop)
      })

      it('getNewAddress', function (done) {
        wallet.initialize(seed)
          .then(function () {
            return wallet.getNewAddress(cclib.definitions.Uncolored, seed)
          })
          .then(function (address) {
            expect(address).to.equal('mmFYK2Mofiwtm68ZTYK7etjiGyf3SeLkgo')
          })
          .done(done, done)
      })

      it('getAllAddresses need initialization', function (done) {
        wallet.getAllAddresses()
          .asCallback(function (err) {
            expect(err).to.be.instanceof(Error)
            done()
          })
          .done(_.noop, _.noop)
      })

      it('getAllAddresses', function (done) {
        wallet.initialize(seed)
          .then(function () {
            return wallet.getAllAddresses(new cclib.definitions.Uncolored())
          })
          .then(function (addresses) {
            expect(addresses).to.deep.equal(
              ['mmHBqwp1fDwWXaXqo5ZrEE4qAoXH5xkUvd'])
          })
          .done(done, done)
      })

      it('getSomeAddress need initialization', function (done) {
        wallet.getSomeAddress(new cclib.definitions.Uncolored())
          .asCallback(function (err) {
            expect(err).to.be.instanceof(Error)
            done()
          })
          .done(_.noop, _.noop)
      })

      it('getSomeAddress', function (done) {
        wallet.initialize(seed)
          .then(function () {
            return wallet.getSomeAddress(new cclib.definitions.Uncolored())
          })
          .then(function (address) {
            expect(address).to.equal('mmHBqwp1fDwWXaXqo5ZrEE4qAoXH5xkUvd')
          })
          .done(done, done)
      })

      it('checkAddress bitcoin', function (done) {
        wallet.initialize(seed)
          .then(function () {
            return wallet.getAssetDefinitionByMoniker('bitcoin')
          })
          .then(function (adef) {
            return wallet.checkAddress(
              'mgFmR51KZRKb2jcmJb276KQK9enC9cmG9v', adef)
          })
          .then(function (isValid) {
            expect(isValid).to.be.true
            done()
          })
          .done(_.noop, _.noop)
      })

      it('checkAddress color', function (done) {
        wallet.initialize(seed)
          .then(function () {
            return wallet.addAssetDefinition(goldAsset, seed)
          })
          .then(function (adef) {
            return wallet.checkAddress(
              'ES5wsZmWHs5xzP@mgFmR51KZRKb2jcmJb276KQK9enC9cmG9v', adef)
          })
          .then(function (isValid) {
            expect(isValid).to.be.true
          })
          .done(done, done)
      })
    })
  })

  it.skip('balance methods', function (done) {
    var fixtures = [
      {method: 'getAvailableBalance', moniker: 'bitcoin', balance: 63326039},
      {method: 'getAvailableBalance', moniker: 'gold', balance: 2000},
      {method: 'getTotalBalance', moniker: 'bitcoin', balance: 63326039},
      {method: 'getTotalBalance', moniker: 'gold', balance: 2000},
      {method: 'getUnconfirmedBalance', moniker: 'bitcoin', balance: 0},
      {method: 'getUnconfirmedBalance', moniker: 'gold', balance: 0}
    ]

    wallet.initialize(seed)
      .then(function () {
        return wallet.addAssetDefinition(goldAsset, seed)
      })
      .then(function () {
        return new Promise(function (resolve) {
          wallet.once('syncStop', resolve)
        })
      })
      .then(function () {
        return Promise.map(fixtures, function (fixture) {
          return wallet.getAssetDefinitionByMoniker(fixture.moniker)
            .then(function (adef) {
              expect(adef).to.be.instanceof(cccore.assets.Definition)
              return wallet[fixture.method].call(wallet, adef)
                .then(function (balance) {
                  console.log(balance, fixture.balance)
                })
            })
        })
      })
      .then(_.noop)
      .done(done, done)
  })

  describe('send, history, issue', function () {
    it.skip('sendCoins', function (done) {
      var deferred // = Q.defer()
      deferred.promise.done(done, done)

      var seed = '421fc385fdae724b246b80e0212f77bb'
      wallet.initialize(seed)
      wallet.addAssetDefinition(seed, goldAsset)
      wallet.once('syncStop', function () {
        var bitcoin = wallet.getAssetDefinitionByMoniker('bitcoin')
        var targets = [{address: 'mkwmtrHX99ozTegy77wTgPZwodm4E2VbBr', value: 10000}]

        wallet.createTx(bitcoin, targets, function (error, tx) {
          expect(error).to.be.null

          wallet.transformTx(tx, 'signed', {seedHex: seed}, function (error, tx) {
            expect(error).to.be.null

            wallet.on('updateTx', function (newTx) {
              if (newTx.getId() === tx.getId()) { deferred.resolve() }
            })

            wallet.sendTx(tx, function (error) {
              expect(error).to.be.null
            })
          })
        })
      })
    })

    it.skip('history', function (done) {
      wallet.initialize(seed)

      wallet.on('syncStop', function () {
        var entries = wallet.getHistory()
        expect(entries).to.be.instanceof(Array)
        done()
      })
    })

    it.skip('issueCoins epobc', function (done) {
      var seed = '421ac385fdaed1121321222eddad0daf'
      wallet.initialize(seed)
      wallet.addAssetDefinition(seed, goldAsset)
      wallet.once('syncStop', function () {
        wallet.createIssuanceTx('newEPOBC', 'epobc', 2, 10000, seed, function (error, tx) {
          expect(error).to.be.null

          wallet.transformTx(tx, 'signed', {seedHex: seed}, function (error, tx) {
            expect(error).to.be.null

            wallet.sendTx(tx, function (error) {
              expect(error).to.be.null
              done()
            })
          })
        })
      })
    })
  })
})
