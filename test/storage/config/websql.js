/* global describe */
'use strict'

var random = require('bitcore').crypto.Random

var cclib = require('../../../')

require('./implementation')({
  describe: describe,
  StorageCls: cclib.storage.config.WebSQL,
  storageOpts: {
    dbName: random.getRandomBuffer(5).toString('hex'),
    dbSize: 1
  }
})
