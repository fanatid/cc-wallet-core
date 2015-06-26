/* global describe */
'use strict'

require('./implementation')({
  describe: describe,
  StorageCls: 'WebSQL',
  storageOpts: {
    prefix: require('crypto').pseudoRandomBytes(5).toString('hex'),
    dbSize: 1
  }
})
