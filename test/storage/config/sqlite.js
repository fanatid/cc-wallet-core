/* global describe */
'use strict'

var cclib = require('../../../')

require('./implementation')({
  describe: describe,
  StorageCls: cclib.storage.config.SQLite,
  storageOpts: {
    filename: ':memory:'
  }
})
