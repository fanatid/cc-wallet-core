var _ = require('lodash')
var store = require('store')

/**
 * @class SyncStorage
 * @param {Object} [opts]
 * @param {string} [opts.globalPrefix=cc_]
 * @param {SyncStorage~AbstractStore} [opts.store=store]
 */
function SyncStorage (opts) {
  opts = _.extend({
    globalPrefix: 'cc_wallet_',
    store: store
  }, opts)

  this.globalPrefix = opts.globalPrefix
  this.store = opts.store
}

module.exports = SyncStorage
