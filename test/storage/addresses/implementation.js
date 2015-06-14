/* global describe, xdescribe, beforeEach, afterEach, it */
'use strict'

var expect = require('chai').expect

var _ = require('lodash')
var Promise = require('bluebird')

module.exports = function (opts) {
  if (opts.StorageCls === undefined) {
    return
  }

  var ldescribe = opts.describe || describe
  if (!opts.StorageCls.isAvailable()) {
    ldescribe = xdescribe
  }

  ldescribe('storage.addresses.' + opts.StorageCls.name, function () {
    var storage
    // master key:
    // xprv9s21ZrQH143K2JF8RafpqtKiTbsbaxEeUaMnNHsm5o6wCW3z8ySyH4UxFVSfZ8n7ESu7fgir8imbZKLYVBxFPND1pniTZ81vKfd45EHKX73
    var pkHex1 = '021c10af30f8380f1ff05a02e10a69bd323a7305c43dc461f79c2b27c13532a12c'
    var pkHex2 = '0375d65343d5dcf4527cf712168b41059cb1df513ba89b44108899835329eb643c'

    beforeEach(function (done) {
      storage = new opts.StorageCls(opts.storageOpts)
      storage.ready.done(done, done)
    })

    afterEach(function (done) {
      storage.clear().done(done, done)
    })

    describe('add', function () {
      it('throw error for account, chain and index', function (done) {
        var data = {account: 0, chain: 0, index: 0}
        storage.add(_.extend({pubkey: pkHex1}, data))
          .then(function () {
            return storage.add(_.extend({pubkey: pkHex2}, data))
          })
          .asCallback(function (err) {
            expect(err).to.be.instanceof(Error)
            done()
          })
          .done(_.noop, _.noop)
      })

      it('throw error for pubkey', function (done) {
        var data = {account: 0, chain: 0, pubkey: pkHex1}
        storage.add(_.extend({index: 0}, data))
          .then(function () {
            return storage.add(_.extend({index: 1}, data))
          })
          .asCallback(function (err) {
            expect(err).to.be.instanceof(Error)
            done()
          })
          .done(_.noop, _.noop)
      })

      it('passed', function (done) {
        var data = {account: 0, chain: 0, index: 0, pubkey: pkHex1}
        storage.add(data)
          .then(function (record) {
            expect(record).to.deep.equal(data)
          })
          .done(done, done)
      })
    })

    describe('get', function () {
      var records = [
        {account: 0, chain: 0, index: 0, pubkey: pkHex1},
        {account: 0, chain: 1, index: 0, pubkey: pkHex2}
      ]

      beforeEach(function (done) {
        Promise.map(records, function (record) {
          return storage.add(record)
        })
        .then(_.noop)
        .done(done, done)
      })

      it('get by account and chain', function (done) {
        storage.get({account: 0, chain: 0})
          .then(function (data) {
            expect(data).to.deep.equal([records[0]])
          })
          .done(done, done)
      })

      it('get', function (done) {
        storage.get()
          .then(function (items) {
            expect(items).to.have.length(records.length)
            items.forEach(function (item) {
              expect(_.find(records, item)).to.be.not.undefined
            })
          })
          .done(done, done)
      })
    })
  })
}
