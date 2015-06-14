/* global describe, xdescribe, beforeEach, afterEach, it */
'use strict'

var _ = require('lodash')
var expect = require('chai').expect
var Promise = require('bluebird')
var random = require('bitcore').crypto.Random

module.exports = function (opts) {
  if (opts.StorageCls === undefined) {
    return
  }

  var ldescribe = opts.describe || describe
  if (!opts.StorageCls.isAvailable()) {
    ldescribe = xdescribe
  }

  ldescribe('storage.rawtx.' + opts.StorageCls.name, function () {
    var storage
    var txid = random.getRandomBuffer(32).toString('hex')
    var rawtx = random.getRandomBuffer(_.random(100, 200)).toString('hex')

    beforeEach(function (done) {
      storage = new opts.StorageCls(opts.storageOpts)
      storage.ready.done(done, done)
    })

    afterEach(function (done) {
      storage.clear().done(done, done)
    })

    describe('add', function () {
      it('passed', function (done) {
        storage.add(txid, rawtx)
          .done(done, done)
      })

      it('same value, passed', function (done) {
        storage.add(txid, rawtx)
          .then(function () {
            return storage.add(txid, rawtx)
          })
          .done(done, done)
      })

      it('throw already exists', function (done) {
        storage.add(txid, rawtx)
          .then(function () {
            return storage.add(txid, rawtx.slice(1))
          })
          .asCallback(function (err) {
            expect(err).to.be.instanceof(Error)
            done()
          })
          .done(_.noop, _.noop)
      })
    })

    describe('get', function () {
      it('exists', function (done) {
        storage.add(txid, rawtx)
          .then(function () {
            return storage.get(txid)
          })
          .then(function (data) {
            expect(data).to.equal(rawtx)
          })
          .done(done, done)
      })

      it('not exists', function (done) {
        storage.get(txid)
          .then(function (data) {
            expect(data).to.be.null
          })
          .done(done, done)
      })
    })

    describe('remove', function () {
      it('exists', function (done) {
        storage.add(txid, rawtx)
          .then(function () {
            return storage.get(txid)
          })
          .then(function (data) {
            expect(data).to.equal(rawtx)
            return storage.remove(txid)
          })
          .then(function () {
            return storage.get(txid)
          })
          .then(function (data) {
            expect(data).to.be.null
          })
          .done(done, done)
      })

      it('not exists', function (done) {
        storage.remove(txid)
          .done(done, done)
      })
    })
  })
}
