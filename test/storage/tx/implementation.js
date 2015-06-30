/* global describe, xdescribe, beforeEach, afterEach, it */
'use strict'

var _ = require('lodash')
var expect = require('chai').expect
var crypto = require('crypto')

var ccwallet = require('../../../')

module.exports = function (opts) {
  var StorageCls = ccwallet.storage.tx[opts.clsName]
  if (StorageCls === undefined) {
    return
  }

  var ldescribe = opts.describe || describe
  if (!StorageCls.isAvailable()) {
    ldescribe = xdescribe
  }

  ldescribe('storage.tx.' + opts.clsName, function () {
    var storage
    var txid = crypto.pseudoRandomBytes(32).toString('hex')
    var data = {
      rawtx: crypto.pseudoRandomBytes(_.random(100, 200)).toString('hex'),
      status: _.random(0, 10),
      blockHeight: null,
      blockHash: null,
      timestamp: Math.round(Date.now() / 1000),
      isBlockTimestamp: false
    }

    beforeEach(function (done) {
      storage = new StorageCls(opts.clsOpts)
      storage.ready.done(done, done)
    })

    afterEach(function (done) {
      storage.clear().done(done, done)
    })

    describe('add', function () {
      it('passed', function (done) {
        storage.add(txid, data)
          .done(done, done)
      })

      it('throw already exists', function (done) {
        storage.add(txid, data)
          .then(function () {
            return storage.add(txid, data)
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
        storage.add(txid, data)
          .then(function () {
            return storage.get(txid)
          })
          .then(function (result) {
            var expected = _.defaults({txid: txid}, result)
            expect(result).to.deep.equal(expected)
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

      it('get all', function (done) {
        storage.add(txid, data)
          .then(function () {
            return storage.get()
          })
          .then(function (result) {
            var expected = [_.defaults({txid: txid}, data)]
            expect(result).to.deep.equal(expected)
          })
          .done(done, done)
      })
    })

    describe('update', function () {
      it('not exists', function (done) {
        storage.update(txid, data)
          .asCallback(function (err) {
            expect(err).to.be.instanceof(Error)
            done()
          })
          .done(_.noop, _.noop)
      })

      it('passed', function (done) {
        var blockHeight = _.random(100000, 300000)
        var blockHash = crypto.pseudoRandomBytes(32).toString('hex')

        storage.add(txid, data)
          .then(function () {
            return storage.update(txid, {
              blockHeight: blockHeight,
              blockHash: blockHash
            })
          })
          .then(function () {
            return storage.get(txid)
          })
          .then(function (result) {
            var expected = _.defaults({
              txid: txid,
              blockHeight: blockHeight,
              blockHash: blockHash
            }, data)
            expect(result).to.deep.equal(expected)
          })
          .done(done, done)
      })
    })

    describe('remove', function () {
      it('exists', function (done) {
        storage.add(txid, data)
          .then(function () {
            return storage.get(txid)
          })
          .then(function (result) {
            var expected = _.defaults({txid: txid}, data)
            expect(result).to.deep.equal(expected)
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
