var expect = require('chai').expect

var bitcoin = require('../src/cclib').bitcoin


/**
 * @param {Network} network
 * @param {function} done
 */
function sendCoins(network, done) {
  var hdnode = bitcoin.HDNode.fromSeedHex('00000000000000000000000000000000', bitcoin.networks.testnet)
  // address is mhW9PYb5jsjpsS5x6dcLrZj7gPvw9mMb9c
  var address = hdnode.pubKey.getAddress(bitcoin.networks.testnet).toBase58Check()

  network.getUnspent(address, function (error, response) {
    expect(error).to.be.null
    expect(response).to.be.instanceof(Array).with.to.have.length.least(1)
    var totalValue = response.reduce(function (a, b) { return {value: a.value + b.value} }).value
    expect(totalValue).to.be.at.least(10000)

    // send totalValue minus 0.1 mBTC to mhW9PYb5jsjpsS5x6dcLrZj7gPvw9mMb9c
    var txb = new bitcoin.TransactionBuilder()
    response.forEach(function (unspent) {
      txb.addInput(unspent.txId, unspent.outIndex)
    })
    txb.addOutput(address, totalValue - 10000)
    response.forEach(function (unspent, index) {
      txb.sign(index, hdnode.privKey)
    })

    var tx = txb.build()
    network.sendTx(tx, function (error, txId) {
      expect(error).to.be.null
      expect(txId).to.equal(tx.getId())
      done(txId)
    })
  })
}


module.exports = {
  sendCoins: sendCoins
}
