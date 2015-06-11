/* global describe */
var cclib = require('../../../')

require('./implementation')({
  describe: describe,
  StorageCls: cclib.storage.addresses.SQLite,
  storageOpts: {
    filename: ':memory:'
  }
})
