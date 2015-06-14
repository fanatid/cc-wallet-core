/* global describe */
'use strict'

var ccwallet = require('../../../')

require('./implementation')({
  describe: describe,
  StorageCls: ccwallet.storage.config.Memory,
  storageOpts: {}
})
