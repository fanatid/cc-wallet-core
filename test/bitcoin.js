var expect = require('chai').expect

var bitcoin = require('../').bitcoin

describe.skip('bitcoin', function () {
  // 304765
  var header = {
    version: 2,
    prevBlockHash: '00000000f376ba762f5b3fe79dd92caffed5e64dd849a28d22fd3e596c297f6b',
    merkleRoot: 'f27a6c628487ee9a7505fbcbecb70847937122712a185809bcc67d8b4103d98c',
    timestamp: 1414399778,
    bits: 437610131,
    nonce: 2247265470
  }
  var headerHex = [
    '020000006b7f296c593efd228da249d84de6d5feaf2cd99de73f5b2f76ba76f3000000008cd90341',
    '8b7dc6bc0958182a712271934708b7eccbfb05759aee8784626c7af222074e549366151abe8cf285'
  ].join('')
  var buffer = new Buffer(headerHex, 'hex')

  it('header2buffer', function () {
    var result = bitcoin.util.header2buffer(header)
    expect(result.toString('hex')).to.equal(buffer.toString('hex'))
  })

  it('buffer2header', function () {
    var result = bitcoin.util.buffer2header(buffer)
    expect(result).to.deep.equal(header)
  })

  it('headerHash', function () {
    var result = bitcoin.util.headerHash(buffer).toString('hex')
    expect(result).to.equal('00000000000011add760c47b4b7309191e58c48a27ca26b76c15ca44ad563151')
  })
})
