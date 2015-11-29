var expect = require('chai').expect
var bitcore = require('bitcore-lib')
var cclib = require('coloredcoinjs-lib')

var ccWallet = require('../src')
var address = ccWallet.address

describe('address.AddressManager', function () {
  var uncolored
  var am
  var amStorage

  var seedHex = '00000000000000000000000000000000'
  var pubKey0 = '021c10af30f8380f1ff05a02e10a69bd323a7305c43dc461f79c2b27c13532a12c'
  var privKey0 = 'KwU5sUhTfs1Sn4ccHznKDvJSUQPfcSa6vN4o4c6mi5AtFiy61AVY'
  var address0 = '18KMigSHDPVFzsgWe1mcaPPA5wSY3Ur5wS'

  beforeEach(function () {
    uncolored = cclib.definitions.Manager.getUncolored()
    amStorage = new address.AddressStorage()
    am = new address.AddressManager(amStorage, bitcore.Networks.livenet)
  })

  afterEach(function () {
    amStorage.clear()
  })

  it('getNewAddress', function () {
    var newAddress = am.getNewAddress(uncolored, seedHex)
    expect(newAddress.getAddress()).to.equal(address0)
  })

  it('getAllAddresses', function () {
    am.getNewAddress(uncolored, seedHex)
    var addresses = am.getAllAddresses(uncolored).map(function (address) {
      return address.getAddress()
    })
    expect(addresses).to.deep.equal([address0])
  })

  it('getPubKeyByAddress', function () {
    am.getNewAddress(uncolored, seedHex)
    var pubKey = am.getPubKeyByAddress(address0)
    expect(pubKey.toString()).to.equal(pubKey0)
  })

  it('getPubKeyByAddress return null', function () {
    var pubKey = am.getPubKeyByAddress(address0)
    expect(pubKey).to.equal(null)
  })

  it('getPrivKeyByAddress', function () {
    am.getNewAddress(uncolored, seedHex)
    var privKey = am.getPrivKeyByAddress(address0, seedHex)
    expect(privKey.toWIF()).to.equal(privKey0)
  })

  it('getPrivKeyByAddress return null', function () {
    var privKey = am.getPrivKeyByAddress(address0)
    expect(privKey).to.equal(null)
  })
})
