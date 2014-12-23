var expect = require('chai').expect

var errors = require('../src').errors
var SyncStorage = require('../src').SyncStorage
var AssetDefinitionStorage = require('../src').asset.AssetDefinitionStorage


describe('asset.AssetDefinitionStorage', function () {
  var storage

  beforeEach(function () {
    storage = new AssetDefinitionStorage()
    storage.add({
      id: '111',
      monikers: ['gold'],
      colorDescs: ['desc1', 'desc1'],
      unit: 10
    })
  })

  afterEach(function () {
    storage.clear()
  })

  it('inherits SyncStorage', function () {
    expect(storage).to.be.instanceof(SyncStorage)
    expect(storage).to.be.instanceof(AssetDefinitionStorage)
  })

  it('add throw error, id already exist', function () {
    var data = {
      id: '111',
      monikers: ['silver'],
      colorDescs: [''],
      unit: 1
    }
    var fn = function () { storage.add(data) }
    expect(fn).to.throw(errors.AlreadyExistsError)
  })

  it('add throw error, moniker already exist', function () {
    var data = {
      id: '113',
      monikers: ['gold'],
      colorDescs: [''],
      unit: 1
    }
    var fn = function () { storage.add(data) }
    expect(fn).to.throw(errors.AlreadyExistsError)
  })

  it('getByMoniker return null', function () {
    var result = storage.getByMoniker('bitcoin')
    expect(result).to.be.null
  })

  it('getByMoniker return object', function () {
    var result = storage.getByMoniker('gold')
    expect(result).to.be.instanceof(Object)
  })

  it('getAll', function () {
    var result = storage.getAll()
    expect(result).to.have.length(1)
    expect(result[0]).to.be.instanceof(Object)
  })
})
