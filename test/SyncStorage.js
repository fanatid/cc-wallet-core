var expect = require('chai').expect

var cclib = require('coloredcoinjs-lib')
var SyncStorage = require('../').SyncStorage

describe.skip('SyncStorage', function () {
  it('inherits coloredcoinjs-lib.SyncStorage', function () {
    var storage = new SyncStorage()
    expect(storage).to.be.instanceof(cclib.SyncStorage)
    expect(storage).to.be.instanceof(SyncStorage)
    expect(storage.store).not.to.be.undefined
  })
})
