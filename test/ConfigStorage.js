var expect = require('chai').expect

var ccWallet = require('../lib')
var ConfigStorage = require('../lib/ConfigStorage')
var SyncStorage = ccWallet.SyncStorage

describe.skip('ConfigStorage', function () {
  var cStorage

  beforeEach(function () {
    cStorage = new ConfigStorage()
  })

  afterEach(function () {
    cStorage.clear()
  })

  it('inherits SyncStorage', function () {
    expect(cStorage).to.be.instanceof(SyncStorage)
    expect(cStorage).to.be.instanceof(ConfigStorage)
  })

  it('set/get', function () {
    cStorage.set('key', 'myValue!!1')
    expect(cStorage.get('key')).to.equal('myValue!!1')
  })

  it('get defaultValue', function () {
    expect(cStorage.get('key', 'myDefaultValye')).to.equal('myDefaultValye')
  })
})
