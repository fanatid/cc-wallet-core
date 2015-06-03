/* global describe, beforeEach, it */
var expect = require('chai').expect
var _ = require('lodash')
var cclib = require('coloredcoinjs-lib')

var ccwallet = require('../../')

describe('asset.AssetDefinition', function () {
  var cdstorage
  var cdmanager
  var adef

  beforeEach(function (done) {
    cdstorage = new cclib.storage.definitions.Memory()
    cdmanager = new cclib.definitions.Manager(cdstorage)
    adef = new ccwallet.asset.AssetDefinition(cdmanager, {
      monikers: ['bitcoin'],
      cdescs: [''],
      unit: 100000000
    })
    cdstorage.ready.done(done, done)
  })

  it('a few items in cdescs throw error', function () {
    var fn = function () {
      adef = new ccwallet.asset.AssetDefinition(cdmanager, {
        monikers: ['bitcoin'],
        cdescs: ['', ''],
        unit: 10
      })
    }
    expect(fn).to.throw(ccwallet.errors.MultiColorNotSupportedError)
  })

  it('unit is not power of 10', function () {
    var fn = function () {
      adef = new ccwallet.asset.AssetDefinition(cdmanager, {
        monikers: ['bitcoin'],
        cdescs: [''],
        unit: 3
      })
    }
    expect(fn).to.throw(ccwallet.errors.VerifyPowerError)
  })

  it('getId', function () {
    expect(adef.getId()).to.equal('JNu4AFCBNmTE1')
  })

  it('getMonikers', function () {
    expect(adef.getMonikers()).to.deep.equal(['bitcoin'])
  })

  it('getColorSet', function () {
    expect(adef.getColorSet()).to.be.instanceof(cclib.ColorSet)
  })

  it('getUnit', function () {
    expect(adef.getUnit()).to.equal(100000000)
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
        adef._unit = fixture.unit
        var result = adef.parseValue(fixture.value)
        expect(result).to.deep.equal(fixture.expect)
      })

      it('#' + (index * 2 + 1), function () {
        if (!_.isNumber(fixture.expect) || fixture.expect === 0) {
          return
        }

        adef._unit = fixture.unit
        var result = adef.parseValue('-' + fixture.value)
        expect(result).to.deep.equal(-fixture.expect)
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
        var result = adef.formatValue(fixture.value)
        expect(result).to.deep.equal(fixture.expect)
      })

      it('#' + (index * 2 + 1), function () {
        if (fixture.value === 0) {
          return
        }

        var result = adef.formatValue(-fixture.value)
        expect(result).to.deep.equal('-' + fixture.expect)
      })
    })
  })

  it.skip('getData', function () {
    expect(adef.getData()).to.deep.equal({
      monikers: ['bitcoin'],
      colorDescs: [''],
      unit: 100000000
    })
  })
})
