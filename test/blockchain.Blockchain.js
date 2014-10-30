var events = require('events')

var expect = require('chai').expect

var Blockchain = require('../src').blockchain.Blockchain


describe('blockchain.Blockchain', function() {
  var blockchain

  beforeEach(function() {
    blockchain = new Blockchain()
  })

  it('inherits events.EventEmitter', function() {
    expect(blockchain).to.be.instanceof(events.EventEmitter)
    expect(blockchain).to.be.instanceof(Blockchain)
  })
})
