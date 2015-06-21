/* global describe, beforeEach, it */
'use strict'

var _ = require('lodash')
var expect = require('chai').expect
var bitcore = require('bitcore')
var cclib = require('coloredcoinjs-lib')

var ccwallet = require('../../')

describe('addresses.Manager', function () {
  var uncolored
  var astorage
  var amanager

  var network = bitcore.Networks.livenet
  var seed = '00000000000000000000000000000000'
  var zeroPrivateKey = 'KwU5sUhTfs1Sn4ccHznKDvJSUQPfcSa6vN4o4c6mi5AtFiy61AVY'
  var zeroAddress = '18KMigSHDPVFzsgWe1mcaPPA5wSY3Ur5wS'

  beforeEach(function (done) {
    uncolored = cclib.definitions.Manager.getUncolored()
    astorage = new ccwallet._storage.addresses.Memory()
    amanager = new ccwallet._addresses.Manager(astorage, network)

    astorage.ready.done(done, done)
  })

  it('getNewAddress', function (done) {
    amanager.on('new', function (address) {
      expect(address.getAddress()).to.equal(zeroAddress)
      amanager.removeAllListeners()
      done()
    })

    amanager.getNewAddress(seed, uncolored)
      .then(function (address) {
        expect(address.getAddress()).to.equal(zeroAddress)
      })
      .done(_.noop, done)
  })

  it('getAllAddresses', function (done) {
    amanager.getNewAddress(seed, uncolored)
      .then(function (address) {
        expect(address.getAddress()).to.equal(zeroAddress)
        return amanager.getAllAddresses(uncolored)
      })
      .then(function (addresses) {
        addresses = _.invoke(addresses, 'getAddress')
        expect(addresses).to.deep.equal([zeroAddress])
      })
      .done(done, done)
  })

  it('getPrivKeyByAddress', function (done) {
    amanager.getNewAddress(seed, uncolored)
      .then(function (address) {
        expect(address.getAddress()).to.equal(zeroAddress)
        return amanager.getPrivateKeyByAddress(seed, zeroAddress)
      })
      .then(function (privateKey) {
        expect(privateKey.toWIF()).to.equal(zeroPrivateKey)
      })
      .done(done, done)
  })

  it('getPrivKeyByAddress return null', function (done) {
    amanager.getPrivateKeyByAddress(zeroAddress)
      .then(function (privateKey) {
        expect(privateKey).to.equal(null)
      })
      .done(done, done)
  })
})
