/* global describe */
'use strict'

var random = require('bitcore').crypto.Random

var cclib = require('../../../')

require('./implementation')({
  describe: describe,
  StorageCls: cclib.storage.rawtx.IndexedDB,
  storageOpts: {
    dbName: random.getRandomBuffer(5).toString('hex')
  }
})
