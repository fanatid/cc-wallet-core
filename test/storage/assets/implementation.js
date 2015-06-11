/* global describe, xdescribe, beforeEach, afterEach, it */
var expect = require('chai').expect

var _ = require('lodash')
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

  ldescribe('storage.assets.' + opts.StorageCls.name, function () {
    var storage
    var records = _.range(4).map(function () {
      return {
        id: random.getRandomBuffer(5).toString('hex'),
        monikers: [random.getRandomBuffer(10).toString('hex')],
        cdescs: [random.getRandomBuffer(10).toString('hex')],
        unit: Math.pow(10, _.random(0, 5))
      }
    })
    records[1].monikers.push(random.getRandomBuffer(10).toString('hex'))
    records[1].monikers.sort()
    records[2].cdescs.push(random.getRandomBuffer(10).toString('hex'))
    records[2].cdescs.sort()
    records[3].monikers.push(random.getRandomBuffer(10).toString('hex'))
    records[3].monikers.sort()
    records[3].cdescs.push(random.getRandomBuffer(10).toString('hex'))
    records[3].cdescs.sort()

    beforeEach(function (done) {
      storage = new opts.StorageCls(opts.storageOpts)
      storage.ready.done(done, done)
    })

    afterEach(function (done) {
      storage.clear().done(done, done)
    })

    describe('#resolve', function () {
      it('return null', function (done) {
        storage.resolve(records[3], {autoAdd: false})
          .then(function (data) {
            expect(data).to.deep.equal({record: null, new: null})
          })
          .done(done, done)
      })

      it('create new record', function (done) {
        storage.resolve(records[3])
          .then(function (data) {
            data.record.monikers.sort()
            data.record.cdescs.sort()
            expect(data).to.deep.equal({record: records[3], new: true})
          })
          .done(done, done)
      })

      it('resolve exists record', function (done) {
        storage.resolve(records[3])
          .then(function (data) {
            data.record.monikers.sort()
            data.record.cdescs.sort()
            expect(data).to.deep.equal({record: records[3], new: true})
            return storage.resolve(records[3])
          })
          .then(function (data) {
            data.record.monikers.sort()
            data.record.cdescs.sort()
            expect(data).to.deep.equal({record: records[3], new: false})
          })
          .done(done, done)
      })
    })

    describe('#get', function () {
      beforeEach(function (done) {
        Promise.map(records, function (record) {
          return storage.resolve(record)
        })
        .then(function (result) {
          expect(result).to.have.length(4)
        })
        .done(done, done)
      })

      it('by moniker return null', function (done) {
        storage.get({moniker: random.getRandomBuffer(10).toString('hex')})
          .then(function (data) {
            expect(data).to.deep.equal(null)
          })
          .done(done, done)
      })

      it('by moniker', function (done) {
        storage.get({moniker: records[3].monikers[0]})
          .then(function (data) {
            data.monikers.sort()
            data.cdescs.sort()
            expect(data).to.deep.equal(records[3])
          })
          .done(done, done)
      })

      it('by cdesc', function (done) {
        storage.get({cdesc: records[3].cdescs[0]})
          .then(function (data) {
            data.monikers.sort()
            data.cdescs.sort()
            expect(data).to.deep.equal(records[3])
          })
          .done(done, done)
      })

      it('get all', function (done) {
        storage.get()
          .then(function (data) {
            data.forEach(function (item) {
              item.monikers.sort()
              item.cdescs.sort()
            })

            expect(_.sortBy(data, 'id')).to.deep.equal(_.sortBy(records, 'id'))
          })
          .done(done, done)
      })
    })
  })
}
