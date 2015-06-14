/* global describe */
'use strict'

var cclib = require('../../../')

require('./implementation')({
  describe: describe,
  StorageCls: cclib.storage.rawtx.SQLite,
  storageOpts: {
    filename: ':memory:'
  }
})
