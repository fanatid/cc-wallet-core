var expect = require('chai').expect

var cclib = require('../src/cclib')
var SyncStorage = require('../src/SyncStorage')


describe('SyncStorage', function () {
  it('inherits coloredcoinjs-lib.SyncStorage', function () {
    var storage = new SyncStorage()
    expect(storage).to.be.instanceof(SyncStorage)
    expect(storage).to.be.instanceof(cclib.SyncStorage)
    expect(storage.store).not.to.be.undefined
  })
})
