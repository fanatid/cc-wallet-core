/* global describe */
'use strict'

require('./implementation')({
  describe: describe,
  clsName: 'LocalStorage',
  clsOpts: {
    prefix: require('crypto').pseudoRandomBytes(5).toString('hex')
  }
})
