/* global describe, xdescribe, beforeEach, afterEach, it */
'use strict'

var _ = require('lodash')
var expect = require('chai').expect
var crypto = require('crypto')

var ccwallet = require('../../../')

module.exports = function (opts) {
  var StorageCls = ccwallet.storage.locktime[opts.clsName]
  if (StorageCls === undefined) {
    return
  }

  var ldescribe = opts.describe || describe
  if (!StorageCls.isAvailable()) {
    ldescribe = xdescribe
  }

  ldescribe('storage.locktime.' + opts.clsName, function () {
    var storage

    beforeEach(function (done) {
      storage = new StorageCls(opts.clsOpts)
      storage.ready.done(done, done)
    })

    afterEach(function (done) {
      storage.clear().done(done, done)
    })

    it('set/get/remove/get', function (done) {
      var txid = crypto.pseudoRandomBytes(32).toString('hex')
      var oidx = _.random(0, 10)
      var lockTime = _.random(10, 20)

      return storage.set(txid, oidx, lockTime)
        .then(function () {
          return storage.get(txid, oidx)
        })
        .then(function (value) {
          expect(value).to.equal(lockTime)
          return storage.remove(txid, oidx)
        })
        .then(function () {
          return storage.get(txid, oidx)
        })
        .then(function (value) {
          expect(value).to.equal(null)
        })
        .done(done, done)
    })
  })
}
