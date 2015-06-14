/* global describe, xdescribe, beforeEach, afterEach, it */
'use strict'

var expect = require('chai').expect
var random = require('bitcore').crypto.Random

module.exports = function (opts) {
  if (opts.StorageCls === undefined) {
    return
  }

  var ldescribe = opts.describe || describe
  if (!opts.StorageCls.isAvailable()) {
    ldescribe = xdescribe
  }

  ldescribe('storage.config.' + opts.StorageCls.name, function () {
    var storage

    beforeEach(function (done) {
      storage = new opts.StorageCls(opts.storageOpts)
      storage.ready.done(done, done)
    })

    afterEach(function (done) {
      storage.clear().done(done, done)
    })

    it('#set', function (done) {
      var key = random.getRandomBuffer(2).toString('hex')
      var value = random.getRandomBuffer(5).toString('hex')
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
      var key = random.getRandomBuffer(2).toString('hex')
      var value = random.getRandomBuffer(5).toString('hex')
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
