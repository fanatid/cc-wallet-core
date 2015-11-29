var expect = require('chai').expect
var _ = require('lodash')
var cclib = require('coloredcoinjs-lib')

var ccWallet = require('../src')
var AssetDefinition = ccWallet.asset.AssetDefinition

describe('asset.AssetDefinition', function () {
  var cdefStorage
  var cdataStorage
  var cdefManager
  var assetdef

  beforeEach(function () {
    cdefStorage = new cclib.storage.definitions.Memory()
    cdataStorage = new cclib.storage.data.Memory()

    cdefManager = new cclib.definitions.Manager(cdefStorage, cdataStorage)

    assetdef = new AssetDefinition(cdefManager, {
      monikers: ['bitcoin'],
      colorDescs: [''],
      unit: 100000000
    })
  })

  it('constructor throw error', function () {
    var data = {
      monikers: ['bitcoin'],
      colorDescs: [''],
      unit: 2
    }
    expect(function () {
      /* eslint-disable */
      new AssetDefinition(cdefManager, data)
      /* eslint-enable */
    }).to.throw(ccWallet.errors.VerifyPowerError)
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
      {value: 'a.00', unit: 100000000, expect: NaN},
      {value: '0.00000000', unit: 100000000, expect: 0},
      {value: '0.00000001', unit: 100000000, expect: 1},
      {value: '0.2', unit: 100000000, expect: 20000000},
      {value: '0.99999999', unit: 100000000, expect: 99999999},
      {value: '1', unit: 100000000, expect: 100000000},
      {value: '1.00000', unit: 100000000, expect: 100000000},
      {value: '1.00000001', unit: 100000000, expect: 100000001},
      {value: '5.345000', unit: 100000000, expect: 534500000},
      {value: '1.1', unit: 1, expect: 1},
      {value: '1.1', unit: 10, expect: 11},
      {value: '1.1', unit: 100, expect: 110}
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
      {value: 0, expect: '0.00000000'},
      {value: 1, expect: '0.00000001'},
      {value: 99999999, expect: '0.99999999'},
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
