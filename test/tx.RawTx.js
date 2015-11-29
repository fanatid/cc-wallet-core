var expect = require('chai').expect

var Q = require('q')
var BIP39 = require('bip39')
var cclib = require('coloredcoinjs-lib')

var cccore = require('../src')
var Wallet = cccore.Wallet
var RawTx = cccore.tx.RawTx

var fixtures = require('./fixtures/tx.RawTx.json')
var btcHexTx = fixtures.tx.uncolored2.raw // mainnet, 2 uncolored outputs
var mnemonic = fixtures.wallet.alice.mnemonic
var password = fixtures.wallet.alice.password

describe('tx.RawTx', function () {
  this.timeout(240 * 1000)

  var rawTx
  var wallet

  beforeEach(function (done) {
    rawTx = RawTx.fromHex(btcHexTx)
    wallet = new Wallet({
      testnet: true,
      blockchain: {name: 'Naive'},
      spendUnconfirmedCoins: true
    })
    wallet.initialize(BIP39.mnemonicToSeedHex(mnemonic, password))
    wallet.once('syncStop', done)
  })

  afterEach(function () {
    rawTx = null
    wallet.getConnector().disconnect()
    wallet.removeListeners()
    wallet.clearStorage()
    wallet = null
  })

  it('toTransaction', function () {
    expect(rawTx.toTransaction().toString()).to.equal(btcHexTx)
  })

  it('getSentColorValues uncolored', function () {
    return Q.ninvoke(rawTx, 'getSentColorValues', wallet)
      .then(function (sentColorValues) {
        expect(sentColorValues).to.be.an('array').with.to.have.length(2)

        expect(sentColorValues[0]).to.be.instanceof(cclib.ColorValue)
        expect(sentColorValues[0].isUncolored()).to.true
        expect(sentColorValues[0].getValue()).to.equal(50000)

        expect(sentColorValues[1]).to.be.instanceof(cclib.ColorValue)
        expect(sentColorValues[1].isUncolored()).to.true
        expect(sentColorValues[1].getValue()).to.equal(38610)
      })
  })

  it('getReceivedColorValues uncolored', function () {
    return Q.ninvoke(rawTx, 'getReceivedColorValues', wallet)
      .then(function (receivedColorValues) {
        expect(receivedColorValues).to.be.an('array').with.to.have.length(1)

        expect(receivedColorValues[0]).to.be.instanceof(cclib.ColorValue)
        expect(receivedColorValues[0].isUncolored()).to.true
        expect(receivedColorValues[0].getValue()).to.equal(34210)
      })
  })

  it('getDeltaColorValues uncolored', function () {
    return Q.ninvoke(rawTx, 'getDeltaColorValues', wallet)
      .then(function (colorValues) {
        expect(colorValues).to.be.an('array').with.to.have.length(1)

        expect(colorValues[0]).to.be.instanceof(cclib.ColorValue)
        expect(colorValues[0].isUncolored()).to.true
        expect(colorValues[0].getValue()).to.equal(-54400)
      })
  })

  describe('getColorTargets uncolored', function () {
    it('gets uncolored targets', function () {
      return Q.ninvoke(rawTx, 'getColorTargets', wallet)
        .then(function (colorTargets) {
          expect(colorTargets).to.be.an('array').with.to.have.length(2)
          colorTargets.forEach(function (colorTarget) {
            expect(colorTarget).to.be.instanceof(cclib.ColorTarget)
            expect(colorTarget.isUncolored()).to.be.true
          })
        })
    })
  })

  describe('satisfiesTargets', function () {
    it('satisfies itself', function () {
      return Q.ninvoke(rawTx, 'getColorTargets', wallet)
        .then(function (cts) {
          return Q.ninvoke(rawTx, 'satisfiesTargets', wallet, cts, false)
        })
        .then(function (satisfied) {
          expect(satisfied).to.be.true
        })
    })

    it('respects allowExtra false', function () {
      return Q.ninvoke(rawTx, 'getColorTargets', wallet)
        .then(function (cts) {
          expect(cts).to.be.an('array')
          cts.pop()
          return Q.ninvoke(rawTx, 'satisfiesTargets', wallet, cts, false)
        })
        .then(function (satisfied) {
          expect(satisfied).to.be.false
        })
    })

    it('respects allowExtra true', function () {
      return Q.ninvoke(rawTx, 'getColorTargets', wallet)
        .then(function (cts) {
          expect(cts).to.be.an('array')
          cts.pop()
          return Q.ninvoke(rawTx, 'satisfiesTargets', wallet, cts, true)
        })
        .then(function (satisfied) {
          expect(satisfied).to.be.true
        })
    })
  })
})
