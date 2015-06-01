var expect = require('chai').expect

var bitcoin = require('../lib').cclib.bitcoin

/**
 * @param {Network} network
 * @return {Q.Promise<string>}
 */
function sendCoins (network) {
  var hdnode = bitcoin.HDNode.fromSeedHex('00000000000000000000000000000000', bitcoin.networks.testnet)
  // address is mhW9PYb5jsjpsS5x6dcLrZj7gPvw9mMb9c
  var address = hdnode.pubKey.getAddress(bitcoin.networks.testnet).toBase58Check()

  return network.getUnspent(address).then(function (response) {
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
    return network.sendTx(tx).then(function (txId) {
      expect(txId).to.equal(tx.getId())
      return txId
    })
  })
}

module.exports = {
  sendCoins: sendCoins
}
