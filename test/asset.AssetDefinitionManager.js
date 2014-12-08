var expect = require('chai').expect

var cclib = require('../src/cclib')
var asset = require('../src/asset')


describe('asset.AssetDefinitionManager', function () {
  var cdStorage
  var cdManager
  var adStorage
  var adManager

  beforeEach(function () {
    cdStorage = new cclib.ColorDefinitionStorage()
    cdManager = new cclib.ColorDefinitionManager(cdStorage)
    adStorage = new asset.AssetDefinitionStorage()
    adManager = new asset.AssetDefinitionManager(cdManager, adStorage)
  })

  afterEach(function () {
    cdStorage.clear()
    adStorage.clear()
  })

  it('create bitcoin AssetDefinition in constructor', function () {
    var assetdefs = adManager.getAllAssets()
    expect(assetdefs).to.have.length(1)
    expect(assetdefs[0].getMonikers()).to.deep.equal(['bitcoin'])
  })

  it('bitcoin AssetDefinition alredy exists', function () {
    adManager = new asset.AssetDefinitionManager(cdManager, adStorage)
    var assetdefs = adManager.getAllAssets()
    expect(assetdefs).to.have.length(1)
    expect(assetdefs[0].getMonikers()).to.deep.equal(['bitcoin'])
  })

  it('resolveAssetDefinition/getAllAssets', function () {
    adManager.resolveAssetDefinition({
      monikers: ['gold'],
      colorDescs: ['epobc:b95323a763fa507110a89ab857af8e949810cf1e67e91104cd64222a04ccd0bb:0:180679'],
      unit: 10000
    })
    var assetdefs = adManager.getAllAssets()
    expect(assetdefs).to.have.length(2)
  })

  it('getByMoniker return AssetDefinition', function () {
    var assetdef = adManager.getByMoniker('bitcoin')
    expect(assetdef).to.be.instanceof(asset.AssetDefinition)
  })

  it('getByMoniker return null', function () {
    var assetdef = adManager.getByMoniker('bronze')
    expect(assetdef).to.be.null
  })
})
