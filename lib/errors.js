'use strict'

var errorSystem = require('error-system')

/**
 * Error
 *  +-- CCWallet
 *       +-- NotImplemented
 */

var spec = {
  name: 'CCWallet',
  message: 'Internal error',
  errors: [{
    name: 'NotImplemented',
    message: '{0}'
  }]
}

errorSystem.extend(Error, spec)
module.exports = Error.CCWallet
