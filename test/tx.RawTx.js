var expect = require('chai').expect

var BIP39 = require('bip39')
var cccore = require('../src')
var ColorTarget = cccore.cclib.ColorTarget
var ColorValue = cccore.cclib.ColorValue
var Wallet = cccore.Wallet
var RawTx = cccore.tx.RawTx

var fixtures = require('./fixtures/tx.RawTx.json')
var btcHexTx = fixtures.tx.uncolored2.raw // mainnet, 2 uncolored outputs
var mnemonic = fixtures.wallet.alice.mnemonic
var password = fixtures.wallet.alice.password


describe('tx.RawTx', function () {
  var rawTx
  var wallet

  beforeEach(function (done) {
    localStorage.clear()
    rawTx = RawTx.fromHex(btcHexTx)
    wallet = new Wallet({
      testnet: true,
      blockchain: 'Naive',
      spendUnconfirmedCoins: true
    })
    wallet.initialize(BIP39.mnemonicToSeedHex(mnemonic, password))
    wallet.subscribeAndSyncAllAddresses(done)
  })

  afterEach(function () {
    rawTx = undefined
    wallet.removeListeners()
    wallet.clearStorage()
    wallet = undefined
  })

  it('toTransaction', function () {
    expect(rawTx.toTransaction().toHex()).to.equal(btcHexTx)
  })

  it('getSentColorValues uncolored', function (done) {
    rawTx.getSentColorValues(wallet, function (error, sentColorValues) {
      expect(error).to.be.null
      expect(sentColorValues).to.be.an('array').with.to.have.length(2)

      expect(sentColorValues[0]).to.be.instanceof(ColorValue)
      expect(sentColorValues[0].isUncolored()).to.true
      expect(sentColorValues[0].getValue()).to.equal(50000)

      expect(sentColorValues[1]).to.be.instanceof(ColorValue)
      expect(sentColorValues[1].isUncolored()).to.true
      expect(sentColorValues[1].getValue()).to.equal(38610)

      done()
    })
  })

  it('getReceivedColorValues uncolored', function (done) {
    rawTx.getReceivedColorValues(wallet, function (error, receivedColorValues) {
      expect(error).to.be.null
      expect(receivedColorValues).to.be.an('array').with.to.have.length(1)

      expect(receivedColorValues[0]).to.be.instanceof(ColorValue)
      expect(receivedColorValues[0].isUncolored()).to.true
      expect(receivedColorValues[0].getValue()).to.equal(34210)

      done()
    })
  })

  it('getDeltaColorValues uncolored', function (done) {
    rawTx.getDeltaColorValues(wallet, function (error, colorValues) {
      expect(error).to.be.null
      expect(colorValues).to.be.an('array').with.to.have.length(1)

      expect(colorValues[0]).to.be.instanceof(ColorValue)
      expect(colorValues[0].isUncolored()).to.true
      expect(colorValues[0].getValue()).to.equal(-54400)

      done()
    })
  })

  describe('getColorTargets uncolored', function () {
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
