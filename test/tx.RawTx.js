var expect = require('chai').expect

var cccore = require('../src')
var ColorTarget = cccore.cclib.ColorTarget
var Wallet = cccore.Wallet
var RawTx = cccore.tx.RawTx

// mainnet, 3 uncolored outputs
var btcHexTx = require('./fixtures/tx.RawTx.json').mainnet.uncolored3


describe('tx.RawTx', function () {
  var wallet
  var rawTx

  beforeEach(function (done) {
    localStorage.clear()
    wallet = new Wallet({
      testnet: false,
      blockchain: 'NaiveBlockchain',
      storageSaveTimeout: 0,
      spendUnconfirmedCoins: true
    })
    wallet.network.on('connect', done)
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

  describe('getColorTargets', function () {
    it('gets mainnet uncolored targets', function (done) {
      rawTx.getColorTargets(wallet, function (error, colorTargets) {
        expect(error).to.be.null
        expect(colorTargets).to.be.an('array').with.to.have.length(3)
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
