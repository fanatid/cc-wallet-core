'use strict'

var errorSystem = require('error-system')

/**
 * Error
 *  +-- CCWallet
 *       +-- NotImplemented
 *       +-- Wallet
 *            +-- AleardyInitialized
 *            +-- NotInitializedYet
 */

var spec = {
  name: 'CCWallet',
  message: 'Internal error',
  errors: [{
    name: 'NotImplemented',
    message: '{0}'
  }, {
    name: 'Wallet',
    message: 'Internal error',
    errors: [{
      name: 'AlreadyInitialized',
      message: 'Wallet already initialized!'
    }, {
      name: 'NotInitializedYet',
      message: 'Initialized wallet first!'
    }]
  }]
}

errorSystem.extend(Error, spec)
module.exports = Error.CCWallet
