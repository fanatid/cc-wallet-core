/* global describe */
var ccwallet = require('../../../')

require('./implementation')({
  describe: describe,
  StorageCls: ccwallet.storage.addresses.Memory,
  storageOpts: {}
})
