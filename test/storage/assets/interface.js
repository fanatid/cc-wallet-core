/* global describe, beforeEach, it */
var expect = require('chai').expect
var _ = require('lodash')

var ccwallet = require('../../../')

describe('storage.assets.Interface', function () {
  var storage

  beforeEach(function () {
    storage = new ccwallet.storage.assets.Interface()
  })

  it('isAvailable', function () {
    expect(ccwallet.storage.assets.Interface.isAvailable()).to.be.false
  })

  it('#resolve', function (done) {
    storage.resolve().asCallback(function (err) {
      expect(err).to.be.instanceof(ccwallet.errors.NotImplemented)
      done()
    })
    .done(_.noop, _.noop)
  })

  it('#get', function (done) {
    storage.get().asCallback(function (err) {
      expect(err).to.be.instanceof(ccwallet.errors.NotImplemented)
      done()
    })
    .done(_.noop, _.noop)
  })

  it('#clear', function (done) {
    storage.clear().asCallback(function (err) {
      expect(err).to.be.instanceof(ccwallet.errors.NotImplemented)
      done()
    })
    .done(_.noop, _.noop)
  })
})
