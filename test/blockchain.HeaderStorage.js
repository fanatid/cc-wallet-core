var expect = require('chai').expect

var HeaderStorage = require('../src').blockchain.HeaderStorage


describe('blockchain.HeaderStorage', function() {
  var storage
  var header = new Buffer(80)

  beforeEach(function(done) {
    storage = new HeaderStorage()
    storage.open(function(error) {
      expect(error).to.be.null
      done()
    })
  })

  afterEach(function(done) {
    storage.clear(function(error) {
      expect(error).to.be.null
      done()
    })
  })

  it('count', function(done) {
    storage.count(function(error, count) {
      expect(error).to.be.null
      expect(count).to.equal(0)
      storage.put([{height: 0, header: header}], function(error) {
        expect(error).to.be.null
        storage.count(function(error, count) {
          expect(error).to.be.null
          expect(count).to.equal(1)
          done()
        })
      })
    })
  })

  it('put', function(done) {
    storage.put([{height: 0, header: header}], function(error) {
      expect(error).to.be.null
      done()
    })
  })

  it('get', function(done) {
    storage.put([{height: 0, header: header}], function(error) {
      expect(error).to.be.null
      storage.get(0, function(error, result) {
        expect(error).to.be.null
        expect(result.toString('hex')).to.equal(header.toString('hex'))
        done()
      })
    })
  })

  it('get not existing index', function(done) {
    storage.put([{height: 0, header: header}], function(error) {
      expect(error).to.be.null
      storage.get(1, function(error, result) {
        expect(error).to.not.be.null
        expect(result).to.be.undefiend
        done()
      })
    })
  })

  it('del', function(done) {
    storage.put([{height: 0, header: header}], function(error) {
      expect(error).to.be.null
      storage.del([0], function(error) {
        expect(error).to.be.null
        done()
      })
    })
  })
})
