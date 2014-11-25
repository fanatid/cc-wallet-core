var _ = require('lodash')

var verify = require('../verify')


/**
 * Sort transactions (sorted by height) in topological order
 *
 * @param {bitcoinjs-lib.Transaction[]}
 * @return {bitcoinjs-lib.Transaction[]}
 */
function toposort(transactions) {
  verify.array(transactions)
  transactions.forEach(verify.Transaction)

  var transactionsIds = _.zipObject(transactions.map(function(tx) { return [tx.getId(), tx] }))
  var result = []
  var resultIds = {}

  function sort(tx, topTx) {
    if (resultIds[tx.getId()] === true)
      return

    tx.ins.forEach(function(input) {
      var inputId = Array.prototype.reverse.call(new Buffer(input.hash)).toString('hex')
      if (_.isUndefined(transactionsIds[inputId]))
        return

      if (transactionsIds[inputId].getId() === topTx.getId())
        throw new Error('graph is cyclical')

      sort(transactionsIds[inputId], tx)
    })

    resultIds[tx.getId()] = true
    result.push(tx)
  }

  transactions.forEach(function(tx) { sort(tx, tx) })

  return result
}


module.exports = toposort
