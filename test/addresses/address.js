/* global describe, beforeEach, it */
'use strict'

var expect = require('chai').expect
var bitcore = require('bitcore')
var cclib = require('coloredcoinjs-lib')

var ccwallet = require('../../')
var Address = ccwallet.addresses.Address

describe('addresses.Address', function () {
  var network = bitcore.Networks.testnet
  var pubkey = bitcore.PrivateKey().toPublicKey().toString()
  var address = bitcore.PublicKey(pubkey).toAddress(network).toString()

  var cdstorage
  var cdmanager
  var uncolored
  var uncoloredAddress
  var epobc
  var epobcAddress

  beforeEach(function (done) {
    cdstorage = new cclib.storage.definitions.Memory()
    cdmanager = new cclib.definitions.Manager(cdstorage)

    uncolored = new ccwallet.assets.Definition(cdmanager, {
      monikers: ['bitcoin'],
      cdescs: [''],
      unit: 100000000
    })
    uncoloredAddress = new Address(pubkey, {adef: uncolored, network: network})

    epobc = new ccwallet.assets.Definition(cdmanager, {
      monikers: ['gold'],
      cdescs: ['epobc:b95323a763fa507110a89ab857af8e949810cf1e67e91104cd64222a04ccd0bb:0:180679'],
      unit: 10000
    })
    epobcAddress = new Address(pubkey, {adef: epobc, network: network})

    cdstorage.ready.done(done, done)
  })

  it('checkAddress return true', function () {
    var ret = Address.checkAddress('18KMigSHDPVFzsgWe1mcaPPA5wSY3Ur5wS')
    expect(ret).to.be.true
  })

  it('checkAddress return false', function () {
    var ret = Address.checkAddress('18KMigSHDPVFzsgWe1mcaPPA5wSY3Ur4wS')
    expect(ret).to.be.false
  })

  it('checkAddress with AssetDefinition return true', function () {
    var ret = Address.checkAddress('ES5wsZmWHs5xzP@1454PJ6L14w6uV2tSy8uKafEJCfPte1GyG', epobc)
    expect(ret).to.be.true
  })

  it('checkAddress with AssetDefinition return false', function () {
    var ret = Address.checkAddress('ES5wsZmWHs5xzX@1454PJ6L14w6uV2tSy8uKafEJCfPte1GyG', epobc)
    expect(ret).to.be.false
  })

  it('checkAddress with bitcoin AssetDefinition', function () {
    var ret = Address.checkAddress('1454PJ6L14w6uV2tSy8uKafEJCfPte1GyG', uncolored)
    expect(ret).to.be.true
  })

  it('getBitcoinAddress with uncolored address', function () {
    var ret = Address.getBitcoinAddress('1454PJ6L14w6uV2tSy8uKafEJCfPte1GyG')
    expect(ret).to.equal('1454PJ6L14w6uV2tSy8uKafEJCfPte1GyG')
  })

  it('getBitcoinAddress with colored address', function () {
    var ret = Address.getBitcoinAddress('ES5wsZmWHs5xzX@1454PJ6L14w6uV2tSy8uKafEJCfPte1GyG')
    expect(ret).to.equal('1454PJ6L14w6uV2tSy8uKafEJCfPte1GyG')
  })

  it('getAssetDefinition return null', function () {
    uncoloredAddress = new Address(pubkey)
    expect(uncoloredAddress.getAssetDefinition()).to.be.null
  })

  it('getAssetDefinition return AssetDefinition', function () {
    expect(epobcAddress.getAssetDefinition()).to.deep.equal(epobc)
  })

  it('getAddress', function () {
    expect(uncoloredAddress.getAddress()).to.equal(address)
  })

  it('getAddress', function () {
    expect(epobcAddress.getAddress()).to.equal(address)
  })

  it('getColorAddress', function () {
    expect(uncoloredAddress.getColorAddress()).to.equal('JNu4AFCBNmTE1@' + address)
  })

  it('getColorAddress', function () {
    expect(epobcAddress.getColorAddress()).to.equal('ES5wsZmWHs5xzP@' + address)
  })
})
