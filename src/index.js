module.exports = {
  bitcoin: require('./bitcoin'),
  cclib: require('./cclib'),
  errors: require('./errors'),
  util: require('./util'),
  verify: require('./verify'),

  SyncStorage: require('./SyncStorage'),

// @todo Remove index.js in subfolders
  address: require('./address'),
  asset: require('./asset'),
  blockchain: require('./blockchain'),
  coin: require('./coin'),
  history: require('./history'),
  network: require('./network'),
  tx: require('./tx'),

  Wallet: require('./wallet/Wallet')
}

Object.defineProperty(module.exports, 'SyncMixin', {
  get: function () {
    console.warn('SyncMixin deprecated for removal in 1.0.0, use util.SyncMixin')
    return module.exports.util.SyncMixin
  }
})
