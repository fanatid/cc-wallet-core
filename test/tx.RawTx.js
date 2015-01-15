var expect = require('chai').expect

var BIP39 = require('bip39')
var cccore = require('../src')
var ColorTarget = cccore.cclib.ColorTarget
var ColorValue = cccore.cclib.ColorValue
var Wallet = cccore.Wallet
var RawTx = cccore.tx.RawTx

var fixtures = require('./fixtures/tx.RawTx.json')
var btcHexTx = fixtures.tx.uncolored2 // mainnet, 2 uncolored outputs
var mnemonic = fixtures.wallet.alice.mnemonic
var password = fixtures.wallet.alice.password


describe('tx.RawTx', function () {
  var rawTx
  var seed
  var wallet

  beforeEach(function (done) {
    localStorage.clear()
    seed = BIP39.mnemonicToSeedHex(mnemonic, password)
    wallet = new Wallet({
      testnet: true,
      blockchain: 'NaiveBlockchain',
      storageSaveTimeout: 0,
      spendUnconfirmedCoins: true
    })
    wallet.initialize(seed)
    wallet.network.on('connect', function(error){
      if (error){
        done(error)
      } else {
        wallet.subscribeAndSyncAllAddresses(done)
      }
    })
    rawTx = RawTx.fromHex(btcHexTx)
  })

  afterEach(function () {
    wallet.removeListeners()
    wallet.clearStorage()
    wallet = undefined
  })

  it('toTransaction', function () {
    expect(rawTx.toTransaction().toHex()).to.equal(btcHexTx)
  })

  it('getReceivedColorValues', function (done) {
    rawTx.getReceivedColorValues(wallet, seed, function(error, received){
      expect(error).to.be.null
      expect(received).to.be.an('array').with.to.have.length(1)
      colorValue = received[0]
      expect(colorValue).to.be.instanceof(ColorValue)
      expect(colorValue.isUncolored()).to.true
      expect(colorValue.getValue()).to.equal(34210)
      done()
    })
  })

  describe('getColorTargets', function () {
    it('gets uncolored targets', function (done) {
      rawTx.getColorTargets(wallet, function (error, colorTargets) {
        expect(error).to.be.null
        expect(colorTargets).to.be.an('array').with.to.have.length(2)
        colorTargets.forEach(function (colorTarget) {
          expect(colorTarget).to.be.instanceof(ColorTarget)
          expect(colorTarget.isUncolored()).to.be.true
        })
        done()
      })
    })
  })

  describe('satisfiesTargets', function () {
    it('satisfies itself', function (done) {
      rawTx.getColorTargets(wallet, function (error, cts) {
        expect(error).to.be.null
        rawTx.satisfiesTargets(wallet, cts, false, function (error, satisfied) {
          expect(error).to.be.null
          expect(satisfied).to.be.true
          done()
        })
      })
    })

    it('respects allowExtra false', function (done) {
      rawTx.getColorTargets(wallet, function (error, cts) {
        expect(error).to.be.null
        expect(cts).to.be.an('array')
        cts.pop()
        rawTx.satisfiesTargets(wallet, cts, false, function (error, satisfied) {
          expect(error).to.be.null
          expect(satisfied).to.be.false
          done()
        })
      })
    })

    it('respects allowExtra true', function (done) {
      rawTx.getColorTargets(wallet, function (error, cts) {
        expect(error).to.be.null
        expect(cts).to.be.an('array')
        cts.pop()
        rawTx.satisfiesTargets(wallet, cts, true, function (error, satisfied) {
          expect(error).to.be.null
          expect(satisfied).to.be.true
          done()
        })
      })
    })
  })
})
