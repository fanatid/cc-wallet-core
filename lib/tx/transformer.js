'use strict'

var bitcore = require('bitcore')
var cclib = require('coloredcoinjs-lib')
var ComposedTx = cclib.tx.Composed

var errors = require('../errors')
var AssetTx = require('./asset')
var OperationalTx = require('./operational')
var RawTx = require('./raw')

/**
 */
function transformTx () {}

/**
 * For a given transaction tx, returns a string that represents
 *  the type of transaction (asset, operational, composed, signed) that it is
 *
 * @name transformTx~classifyTx
 * @param {(AssetTx|OperationalTx|ComposedTx|RawTx|Transaction)} tx
 * @return {?string}
 */
function classifyTx (tx) {
  if (tx instanceof AssetTx) {
    return 'asset'
  }

  if (tx instanceof OperationalTx) {
    return 'operational'
  }

  if (tx instanceof ComposedTx) {
    return 'composed'
  }

  if (tx instanceof RawTx) {
    return 'raw'
  }

  if (tx instanceof bitcore.Transaction) {
    return tx.isFullySigned() ? 'signed' : 'partially-signed'
  }

  return null
}

/**
 * @name transformTx~transformAssetTx
 * @param {AssetTx} assetTx
 * @param {string} targetKind
 * @param {Object} [opts]
 * @return {Promise.<(OperationalTx|coloredcoinjs-lib.ComposedTx|RawTx|bitcore.Transaction)>}
 */
function transformAssetTx (assetTx, targetKind, opts) {
  return Promise.try(function () {
    if (['operational', 'composed', 'raw', 'signed'].indexOf(targetKind) === -1) {
      throw new Error('AssetTx to ' + targetKind)
    }

    var operationalTx = assetTx.makeOperationalTx()
    return transformTx(operationalTx, targetKind, opts)
  })
}

/**
 * @name transformTx~transformOperationalTx
 * @param {OperationalTx} operationalTx
 * @param {string} targetKind
 * @param {Object} [opts]
 * @return {Promise.<(coloredcoinjs-lib.ComposedTx|RawTx|bitcore.Transaction)>}
 */
function transformOperationalTx (operationalTx, targetKind, opts) {
  return Promise.try(function () {
    if (['composed', 'raw', 'signed'].indexOf(targetKind) === -1) {
      throw new Error('OperationalTx to ' + targetKind)
    }

    if (!operationalTx.isMonoColor()) {
      throw new errors.MultiColorNotSupportedError('Attempt transform multi-color OperationalTx')
    }

    var composer = operationalTx.getTargets()[0].getColorDefinition().constructor.makeComposedTx
    if (composer === undefined) {
      throw new Error('ComposerFunctionNotFoundError')
    }

    return composer(operationalTx)
  })
  .then(function (composedTx) {
    return transformTx(composedTx, targetKind, opts)
  })
}

/**
 * @name transformTx~transformComposedTx
 * @param {ComposedTx} composedTx
 * @param {string} targetKind
 * @param {Object} opts
 * @return {Promise.<(RawTx|bitcore.Transaction)>}
 */
function transformComposedTx (composedTx, targetKind, opts, cb) {
  return Promise.try(function () {
    if (['raw', 'signed'].indexOf(targetKind) === -1) {
      throw new Error('ComposedTx to ' + targetKind)
    }

    return RawTx({wallet: opts.wallet, composed: composedTx})
  })
  .then(function (rawtx) {
    return transformTx(rawtx, targetKind, opts)
  })
}

/**
 * @name transformTx~transformRawTx
 * @param {RawTx} rawtx
 * @param {string} targetKind
 * @param {Object} opts
 * @return {Promise.<bitcore.Transaction>}
 */
function transformRawTx (rawtx, targetKind, opts, cb) {
  return Promise.try(function () {
    if (['signed', 'partially-signed'].indexOf(targetKind) === -1) {
      throw new Error('RawTx to ' + targetKind)
    }

    var rawtx = rawtx.clone()
    return rawtx.sign(opts.seedHex, opts.signingOnly)
  })
  .then(function () {
    var allowIncomplete = (targetKind === 'partially-signed')
    return rawtx.toTx(allowIncomplete)
  })
}

/**
 * Transform a transaction tx into another type of transaction defined by targetKind.
 *
 * AssetTx  -> OperationalTx -> ComposedTx -> RawTx -> Transaction
 * "simple" -> "operational" -> "composed" -> "raw" -> ("signed" or "partially-signed")
 *
 * @param {(AssetTx|OperationalTx|ComposedTx|RawTx|bitcore.Transaction)} tx
 * @param {string} targetKind
 * @param {Object} [opts] Required if targetKind is signed
 * @param {string} [opts.seedHex]
 * @param {Wallet} [opts.wallet]
 * @param {number[]} [opts.signingOnly] Sign only given indexes
 * @return {Promise.<(OperationalTx|ComposedTx|RawTx|bitcore.Transaction)>}
 */
function transformTx (tx, targetKind, opts) {
  opts = opts || {}

  return Promise.try(function () {
    var currentKind = classifyTx(tx)
    if (currentKind === null) {
      throw new errors.TxKindIsNotRecognizedError()
    }

    if ([targetKind, 'signed', 'partially-signed'].indexOf(currentKind) !== -1) {
      return tx
    }

    if (currentKind === 'asset') {
      return transformAssetTx(tx, targetKind, opts)
    }

    if (currentKind === 'operational') {
      return transformOperationalTx(tx, targetKind, opts)
    }

    if (currentKind === 'composed') {
      return transformComposedTx(tx, targetKind, opts)
    }

    if (currentKind === 'raw') {
      return transformRawTx(tx, targetKind, opts)
    }
  })
}

module.exports = transformTx
