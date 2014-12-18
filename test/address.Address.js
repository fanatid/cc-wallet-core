var expect = require('chai').expect

var cclib = require('../src/cclib')
var bitcoin = cclib.bitcoin
var networks = bitcoin.networks

var address = require('../src/address')
var asset = require('../src/asset')


describe('address.Address', function () {
  var cdStorage
  var cdManager
  var adStorage
  var adManager
  var am
  var amStorage
  var uncolored
  var uncoloredAddress
  var epobc
  var epobcAddress

  var seedHex = '00000000000000000000000000000000'

  beforeEach(function () {
    cdStorage = new cclib.ColorDefinitionStorage()
    cdManager = new cclib.ColorDefinitionManager(cdStorage)
    adStorage = new asset.AssetDefinitionStorage()
    adManager = new asset.AssetDefinitionManager(cdManager, adStorage)

    amStorage = new address.AddressStorage()
    am = new address.AddressManager(amStorage, networks.bitcoin)

    uncolored = adManager.resolveAssetDefinition({
      monikers: ['bitcoin'],
      colorDescs: [''],
      unit: 100000000
    })
    uncoloredAddress = am.getNewAddress(uncolored, seedHex)
    epobc = adManager.resolveAssetDefinition({
      monikers: ['gold'],
      colorDescs: ['epobc:b95323a763fa507110a89ab857af8e949810cf1e67e91104cd64222a04ccd0bb:0:180679'],
      unit: 10000
    })
    epobcAddress = am.getNewAddress(epobc, seedHex)
  })

  afterEach(function () {
    cdStorage.clear()
    adStorage.clear()
    amStorage.clear()
  })

  it('checkAddress', function () {
    var result = address.Address.checkAddress('18KMigSHDPVFzsgWe1mcaPPA5wSY3Ur5wS')
    expect(result).to.be.true
  })

  it('checkAddress return false', function () {
    var result = address.Address.checkAddress('18KMigSHDPVFzsgWe1mcaPPA5wSY3Ur4wS')
    expect(result).to.be.false
  })

  it('checkColorAddress', function () {
    var result = address.Address.checkColorAddress(epobc, 'ES5wsZmWHs5xzP@1454PJ6L14w6uV2tSy8uKafEJCfPte1GyG')
    expect(result).to.be.true
  })

  it('checkColorAddress return false', function () {
    var result = address.Address.checkColorAddress(epobc, 'ES5wsZmWHs5xzX@1454PJ6L14w6uV2tSy8uKafEJCfPte1GyG')
    expect(result).to.be.false
  })

  it('getPubKey', function () {
    var pubKey = uncoloredAddress.getPubKey()
    expect(pubKey.toHex()).to.equal('021c10af30f8380f1ff05a02e10a69bd323a7305c43dc461f79c2b27c13532a12c')
  })

  it('getPrivKey', function () {
    var privKey = uncoloredAddress.getPrivKey(seedHex)
    expect(privKey.toWIF()).to.equal('KwU5sUhTfs1Sn4ccHznKDvJSUQPfcSa6vN4o4c6mi5AtFiy61AVY')
  })

  it('getAssetDefinition return null', function () {
    uncolored = cclib.ColorDefinitionManager.getUncolored()
    uncoloredAddress = am.getNewAddress(uncolored, seedHex)
    expect(uncoloredAddress.getAssetDefinition()).to.be.null
  })

  it('getAssetDefinition return AssetDefinition', function () {
    expect(epobcAddress.getAssetDefinition()).to.deep.equal(epobc)
  })

  it('getAddress', function () {
    expect(uncoloredAddress.getAddress()).to.equal('18KMigSHDPVFzsgWe1mcaPPA5wSY3Ur5wS')
  })

  it('getAddress', function () {
    expect(epobcAddress.getAddress()).to.equal('1454PJ6L14w6uV2tSy8uKafEJCfPte1GyG')
  })

  it('getColorAddress', function () {
    expect(uncoloredAddress.getColorAddress()).to.equal('JNu4AFCBNmTE1@18KMigSHDPVFzsgWe1mcaPPA5wSY3Ur5wS')
  })

  it('getColorAddress', function () {
    expect(epobcAddress.getColorAddress()).to.equal('ES5wsZmWHs5xzP@1454PJ6L14w6uV2tSy8uKafEJCfPte1GyG')
  })
})
