var inherits = require('util').inherits

var _ = require('lodash')

var cclib = require('./cclib')


/**
 * @class SyncStorage
 * @extends external:coloredcoinjs-lib.SyncStorage
 * {@link external:coloredcoinjs-lib.SyncStorage~constructor}
 */
function SyncStorage(opts) {
  opts = _.extend({
    globalPrefix: 'cc_wallet_'
  }, opts)

  cclib.SyncStorage.call(this, opts)
}

inherits(SyncStorage, cclib.SyncStorage)


module.exports = SyncStorage
