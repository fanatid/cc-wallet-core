var expect = require('chai').expect
var cclib = require('coloredcoinjs-lib')

var ccWallet = require('../src')
var asset = ccWallet.asset

describe('asset.AssetDefinitionManager', function () {
  var cdefStorage
  var cdataStorage
  var cdefManager
  var adefStorage
  var adefManager

  beforeEach(function () {
    cdefStorage = new cclib.storage.definitions.Memory()
    cdataStorage = new cclib.storage.data.Memory()
    cdefManager = new cclib.definitions.Manager(cdefStorage, cdataStorage)

    adefStorage = new asset.AssetDefinitionStorage()
    adefManager = new asset.AssetDefinitionManager(cdefManager, adefStorage)
  })

  afterEach(function () {
    adefStorage.clear()
  })

  it('create bitcoin AssetDefinition in constructor', function () {
    var assetdefs = adefManager.getAllAssets()
    expect(assetdefs).to.have.length(1)
    expect(assetdefs[0].getMonikers()).to.deep.equal(['bitcoin'])
  })

  it('bitcoin AssetDefinition alredy exists', function () {
    adefManager = new asset.AssetDefinitionManager(cdefManager, adefStorage)
    var assetdefs = adefManager.getAllAssets()
    expect(assetdefs).to.have.length(1)
    expect(assetdefs[0].getMonikers()).to.deep.equal(['bitcoin'])
  })

  it('resolveAssetDefinition/getAllAssets', function () {
    adefManager.resolveAssetDefinition({
      monikers: ['gold'],
      colorDescs: ['epobc:b95323a763fa507110a89ab857af8e949810cf1e67e91104cd64222a04ccd0bb:0:180679'],
      unit: 10000
    })
    var assetdefs = adefManager.getAllAssets()
    expect(assetdefs).to.have.length(2)
  })

  it('getByMoniker return AssetDefinition', function () {
    var assetdef = adefManager.getByMoniker('bitcoin')
    expect(assetdef).to.be.instanceof(asset.AssetDefinition)
  })

  it('getByMoniker return null', function () {
    var assetdef = adefManager.getByMoniker('bronze')
    expect(assetdef).to.be.null
  })
})
