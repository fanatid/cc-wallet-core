/* global describe, xdescribe, beforeEach, afterEach, it */
'use strict'

var expect = require('chai').expect
var crypto = require('crypto')

var ccwallet = require('../../../')

module.exports = function (opts) {
  var StorageCls = ccwallet._storage.config[opts.clsName]
  if (StorageCls === undefined) {
    return
  }

  var ldescribe = opts.describe || describe
  if (!StorageCls.isAvailable()) {
    ldescribe = xdescribe
  }

  ldescribe('storage.config.' + opts.clsName, function () {
    var storage

    beforeEach(function (done) {
      storage = new StorageCls(opts.clsOpts)
      storage.ready.done(done, done)
    })

    afterEach(function (done) {
      storage.clear().done(done, done)
    })

    it('#set', function (done) {
      var key = crypto.pseudoRandomBytes(2).toString('hex')
      var value = crypto.pseudoRandomBytes(5).toString('hex')
      storage.set(key, value)
        .then(function () {
          return storage.get(key)
        })
        .then(function (data) {
          expect(data).to.equal(value)
        })
        .done(done, done)
    })

    it('#get', function (done) {
      var key = crypto.pseudoRandomBytes(2).toString('hex')
      var value = crypto.pseudoRandomBytes(5).toString('hex')
      storage.get(key)
        .then(function (data) {
          expect(data).to.be.undefined
          return storage.get(key, value)
        })
        .then(function (data) {
          expect(data).to.equal(value)
        })
        .done(done, done)
    })
  })
}
