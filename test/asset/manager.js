/* global describe, beforeEach, it */
var expect = require('chai').expect
var _ = require('lodash')
var Promise = require('bluebird')
var cclib = require('coloredcoinjs-lib')

var ccwallet = require('../../')

describe('asset.AssetManager', function () {
  var cdstorage
  var cdmanager
  var adstorage
  var admanager

  var epobcdata = {
    monikers: ['epobc', 'gold'],
    cdescs: ['epobc:e88416a44a7f0000e023b70100000000e023b701000000000a00000000000000:0:125421'],
    unit: Math.pow(10, _.random(1, 5))
  }
  var epobcId = 'nbzBwDtfAFx9D'

  beforeEach(function (done) {
    cdstorage = new cclib.storage.definitions.Memory()
    cdmanager = new cclib.definitions.Manager(cdstorage)
    adstorage = new ccwallet.storage.definitions.Memory()
    admanager = new ccwallet.asset.AssetManager(cdmanager, adstorage)
    Promise.all([cdstorage.ready, adstorage.ready])
      .then(_.noop).done(done, done)
  })

  describe('resolve', function () {
    it('resolve default bitcoin asset', function (done) {
      var data = {
        monikers: ['bitcoin'],
        cdescs: [cclib.definitions.Manager.getUncolored().getDesc()],
        unit: 100000000
      }
      admanager.resolve(data)
        .then(function (adef) {
          expect(adef).to.be.instanceof(ccwallet.asset.AssetDefinition)
          expect(adef.getId()).to.equal('JNu4AFCBNmTE1')
        })
        .done(done, done)
    })

    it('add asset and generate event `new`', function (done) {
      var deferred = Promise.defer()

      admanager.on('new', function (adef) {
        Promise.try(function () {
          expect(adef).to.be.instanceof(ccwallet.asset.AssetDefinition)
          if (adef.getMonikers()[0] === 'bitcoin') {
            return
          }

          expect(adef.getId()).to.equal(epobcId)
          deferred.resolve()
        })
        .done(_.noop, function (err) { deferred.reject(err) })
      })

      admanager.resolve(epobcdata)
        .then(function (adef) {
          expect(adef).to.be.instanceof(ccwallet.asset.AssetDefinition)
          expect(adef.getId()).to.equal(epobcId)
          return deferred.promise
        })
        .finally(function () {
          admanager.removeAllListeners()
        })
        .done(done, done)
    })

    it('return `null` on opts.autoAdd = false', function (done) {
      admanager.resolve(epobcdata, {autoAdd: false})
        .then(function (adef) {
          expect(adef).to.equal(null)
        })
        .done(done, done)
    })
  })

  describe('get', function () {
    it('all', function (done) {
      admanager.get()
        .then(function (adefs) {
          expect(adefs).to.have.length(1)
          expect(adefs[0]).to.be.instanceof(ccwallet.asset.AssetDefinition)
          expect(adefs[0].getId()).to.equal('JNu4AFCBNmTE1')
        })
        .done(done, done)
    })

    it('by moniker, asset definition', function (done) {
      admanager.get({moniker: 'bitcoin'})
        .then(function (adef) {
          expect(adef).to.be.instanceof(ccwallet.asset.AssetDefinition)
          expect(adef.getId()).to.equal('JNu4AFCBNmTE1')
        })
        .done(done, done)
    })

    it('by moniker, null', function (done) {
      admanager.get({moniker: epobcdata.monikers[0]})
        .then(function (adef) {
          expect(adef).to.be.null
        })
        .done(done, done)
    })

    it('by cdesc, asset definition', function (done) {
      admanager.get({cdesc: cclib.definitions.Manager.getUncolored().getDesc()})
        .then(function (adef) {
          expect(adef).to.be.instanceof(ccwallet.asset.AssetDefinition)
          expect(adef.getId()).to.equal('JNu4AFCBNmTE1')
        })
        .done(done, done)
    })

    it('by cdesc, null', function (done) {
      admanager.get({cdesc: epobcdata.cdescs[0]})
        .then(function (adef) {
          expect(adef).to.be.null
        })
        .done(done, done)
    })
  })

  describe('update', function () {
  })
})
