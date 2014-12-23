var expect = require('chai').expect
var _ = require('lodash')

var cclib = require('../src').cclib
var errors = require('../src').errors
var AssetDefinition = require('../src/asset').AssetDefinition


describe('asset.AssetDefinition', function () {
  var cdStorage
  var cdManager
  var assetdef

  beforeEach(function () {
    cdStorage = new cclib.ColorDefinitionStorage()
    cdManager = new cclib.ColorDefinitionManager(cdStorage)
    assetdef = new AssetDefinition(cdManager, {
      monikers: ['bitcoin'],
      colorDescs: [''],
      unit: 100000000
    })
    cdStorage.clear()
  })

  it('constructor throw error', function () {
    var data = {
      monikers: ['bitcoin'],
      colorDescs: [''],
      unit: 2
    }
    var fn = function () { new AssetDefinition(cdManager, data) }
    expect(fn).to.throw(errors.VerifyPowerError)
  })

  it('getId', function () {
    expect(assetdef.getId()).to.equal('JNu4AFCBNmTE1')
  })

  it('getMonikers', function () {
    expect(assetdef.getMonikers()).to.deep.equal(['bitcoin'])
  })

  it('getColorSet', function () {
    expect(assetdef.getColorSet()).to.be.instanceof(cclib.ColorSet)
  })

  describe('parseValue', function () {
    var fixtures = [
      {value: 'a.00',       unit: 100000000, expect: NaN},
      {value: '0.00000000', unit: 100000000, expect: 0},
      {value: '0.00000001', unit: 100000000, expect: 1},
      {value: '0.2',        unit: 100000000, expect: 20000000},
      {value: '0.99999999', unit: 100000000, expect: 99999999},
      {value: '1',          unit: 100000000, expect: 100000000},
      {value: '1.00000',    unit: 100000000, expect: 100000000},
      {value: '1.00000001', unit: 100000000, expect: 100000001},
      {value: '5.345000',   unit: 100000000, expect: 534500000},
      {value: '1.1',        unit: 1,         expect: 1},
      {value: '1.1',        unit: 10,        expect: 11},
      {value: '1.1',        unit: 100,       expect: 110}
    ]

    fixtures.forEach(function (fixture, index) {
      it('#' + (index * 2), function () {
        assetdef.unit = fixture.unit
        expect(assetdef.parseValue(fixture.value)).to.deep.equal(fixture.expect)
      })

      it('#' + (index * 2 + 1), function () {
        if (!_.isNumber(fixture.expect) || fixture.expect === 0) {
          return
        }

        assetdef.unit = fixture.unit
        expect(assetdef.parseValue('-' + fixture.value)).to.deep.equal(-fixture.expect)
      })
    })
  })

  describe('formatValue', function () {
    var fixtures = [
      {value: 0,         expect: '0.00000000'},
      {value: 1,         expect: '0.00000001'},
      {value: 99999999,  expect: '0.99999999'},
      {value: 100000000, expect: '1.00000000'},
      {value: 100000001, expect: '1.00000001'},
      {value: 534500000, expect: '5.34500000'}
    ]

    fixtures.forEach(function (fixture, index) {
      it('#' + (index * 2), function () {
        expect(assetdef.formatValue(fixture.value)).to.deep.equal(fixture.expect)
      })

      it('#' + (index * 2 + 1), function () {
        if (fixture.value === 0) {
          return
        }

        expect(assetdef.formatValue(-fixture.value)).to.deep.equal('-' + fixture.expect)
      })
    })
  })

  it('getData', function () {
    expect(assetdef.getData()).to.deep.equal({
      monikers: ['bitcoin'],
      colorDescs: [''],
      unit: 100000000
    })
  })
})
