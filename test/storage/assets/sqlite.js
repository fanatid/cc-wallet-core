/* global describe */
'use strict'

var cclib = require('../../../')

require('./implementation')({
  describe: describe,
  StorageCls: cclib.storage.assets.SQLite,
  storageOpts: {
    filename: ':memory:'
  }
})
