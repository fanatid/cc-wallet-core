var events = require('events')

var expect = require('chai').expect

var Network = require('../src').network.Network


describe('network.Network', function() {
  var network

  beforeEach(function() {
    network = new Network()
  })

  it('inherits events.EventEmitter', function() {
    expect(network).to.be.instanceof(events.EventEmitter)
    expect(network).to.be.instanceof(Network)
  })

  it('isConnected', function() {
    expect(network.isConnected()).to.be.false
  })

  it('getCurrentHeight', function() {
    expect(network.getCurrentHeight()).to.equal(-1)
  })

  it('getCurrentBlockHash', function() {
    var result = network.getCurrentBlockHash().toString('hex')
    expect(result).to.equal(new Buffer(32).fill(0).toString('hex'))
  })
})
