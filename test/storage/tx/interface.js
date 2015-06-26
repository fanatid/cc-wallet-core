/* global describe, beforeEach, it */
'use strict'

var expect = require('chai').expect
var _ = require('lodash')

var ccwallet = require('../../../')

describe('storage.tx.Interface', function () {
  var storage

  beforeEach(function () {
    storage = new ccwallet._storage.tx.Interface()
  })

  it('isAvailable', function () {
    expect(ccwallet._storage.tx.Interface.isAvailable()).to.be.false
  })

  it('#add', function (done) {
    storage.add()
      .asCallback(function (err) {
        expect(err).to.be.instanceof(ccwallet.errors.NotImplemented)
        done()
      })
      .done(_.noop, _.noop)
  })

  it('#get', function (done) {
    storage.get()
      .asCallback(function (err) {
        expect(err).to.be.instanceof(ccwallet.errors.NotImplemented)
        done()
      })
      .done(_.noop, _.noop)
  })

  it('#update', function (done) {
    storage.update()
      .asCallback(function (err) {
        expect(err).to.be.instanceof(ccwallet.errors.NotImplemented)
        done()
      })
      .done(_.noop, _.noop)
  })

  it('#remove', function (done) {
    storage.remove()
      .asCallback(function (err) {
        expect(err).to.be.instanceof(ccwallet.errors.NotImplemented)
        done()
      })
      .done(_.noop, _.noop)
  })

  it('#clear', function (done) {
    storage.clear()
      .asCallback(function (err) {
        expect(err).to.be.instanceof(ccwallet.errors.NotImplemented)
        done()
      })
      .done(_.noop, _.noop)
  })
})
