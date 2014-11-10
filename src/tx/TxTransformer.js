var _ = require('lodash')
var Q = require('q')

var bitcoin = require('../bitcoin')
var AssetTx = require('./AssetTx')
var OperationalTx = require('./OperationalTx')
var ComposedTx = require('../cclib').ComposedTx
var RawTx = require('./RawTx')
var verify = require('../verify')


/**
 * For a given transaction tx, returns a string that represents
 *  the type of transaction (asset, operational, composed, signed) that it is
 *
 * @param {(AssetTx|OperationalTx|ComposedTx|RawTx|Transaction)} tx
 * @return {?string}
 */
function classifyTx(tx) {
  if (tx instanceof AssetTx)
    return 'asset'

  if (tx instanceof OperationalTx)
    return 'operational'

  if (tx instanceof ComposedTx)
    return 'composed'

  if (tx instanceof RawTx)
    return 'raw'

  if (tx instanceof bitcoin.Transaction) {
    var isSigned = tx.ins.every(function(input) { return input.script !== bitcoin.Script.EMPTY })
    if (isSigned)
      return 'signed'
    else
      return 'partially-signed'
  }

  return null
}

/**
 * @callback transformAssetTx~callback
 * @param {?Error} error
 * @param {OperationalTx} operationalTx
 */

/**
 * Takes a AssetTx assetTx and returns a transaction
 *  of type targetKind which is one of (operational, composed, signed)
 *
 * @param {AssetTx} assetTx
 * @param {string} targetKind
 * @param {Object} opts
 * @param {transformAssetTx~callback} cb
 */
function transformAssetTx(assetTx, targetKind, opts, cb) {
  verify.AssetTx(assetTx)
  verify.string(targetKind)
  verify.object(opts)
  verify.function(cb)

  Q.fcall(function() {
    if (['operational', 'composed', 'raw', 'signed'].indexOf(targetKind) === -1)
      throw new Error('do not know how to transform assetTx')

    if (!assetTx.isMonoColor())
      throw new Error('multi color AssetTx not supported')

    var operationalTx = assetTx.makeOperationalTx()
    return Q.nfcall(transformTx, operationalTx, targetKind, opts)

  }).done(function(targetTx) { cb(null, targetTx) }, function(error) { cb(error) })
}

/**
 * @callback transformOperationalTx~callback
 * @param {?Error} error
 * @param {ComposedTx} composedTx
 */

/**
 * Takes a OperationalTx operationalTx and returns a transaction
 *  of type targetKind which is one of (composed, signed)
 *
 * @param {OperationalTx} operationalTx
 * @param {string} targetKind
 * @param {Object} opts
 * @param {transformOperationalTx~callback} cb
 */
function transformOperationalTx(operationalTx, targetKind, opts, cb) {
  verify.OperationalTx(operationalTx)
  verify.string(targetKind)
  verify.object(opts)
  verify.function(cb)

  Q.fcall(function() {
    if (['composed', 'raw', 'signed'].indexOf(targetKind) === -1)
      throw new Error('do not know how to transform operationalTx')

    if (!operationalTx.isMonoColor())
      throw new Error('multi color operationalTx not supported')

    var composer = operationalTx.getTargets()[0].getColorDefinition().constructor.makeComposedTx
    if (_.isUndefined(composer))
      throw new Error('composer not found')

    return Q.nfcall(composer, operationalTx)

  }).then(function(composedTx) {
    return Q.nfcall(transformTx, composedTx, targetKind, opts)

  }).done(function(targetTx) { cb(null, targetTx) }, function(error) { cb(error) })
}

/**
 * @callback transformComposedTx~callback
 * @param {?Error} error
 * @param {Transaction} tx
 */

/**
 * Takes a ComposedTx composedTx and returns a transaction
 *  of type targetKind which is one of (raw, signed)
 *
 * @param {ComposedTx} composedTx
 * @param {string} targetKind
 * @param {Object} opts
 * @param {transformComposedTx~callback} cb
 */
function transformComposedTx(composedTx, targetKind, opts, cb) {
  verify.ComposedTx(composedTx)
  verify.string(targetKind)
  verify.object(opts)
  verify.function(cb)

  Q.fcall(function() {
    if (['raw', 'signed'].indexOf(targetKind) === -1)
      throw new Error('do not know how to transform composedTx')

    return RawTx.fromComposedTx(composedTx)

  }).then(function(rawTx) {
    return Q.nfcall(transformTx, rawTx, targetKind, opts)

  }).done(function(targetTx) { cb(null, targetTx) }, function(error) { cb(error) })
}

/**
 * @callback transformRawTx~callback
 * @param {?Error} error
 * @param {Transaction} tx
 */

/**
 * Takes a RawTx rawTx and returns a transaction
 *  of type targetKind which is one of (signed)
 *
 * @param {RawTx} rawTx
 * @param {string} targetKind
 * @param {Object} opts
 * @param {transformRawTx~callback} cb
 */
function transformRawTx(rawTx, targetKind, opts, cb) {
  verify.RawTx(rawTx)
  verify.string(targetKind)
  verify.object(opts)
  verify.Wallet(opts.wallet)
  verify.hexString(opts.seedHex)
  verify.function(cb)

  Q.fcall(function() {
    if (['signed', 'partially-signed'].indexOf(targetKind) === -1)
      throw new Error('do not know how to transform rawTx')

    return Q.ninvoke(rawTx, 'sign', opts.wallet, opts.seedHex)

  }).then(function() {
    var allowIncomplete = (targetKind == 'partially-signed')
    return rawTx.toTransaction(allowIncomplete)

  }).then(function(signedTx) {
    return Q.nfcall(transformTx, signedTx, targetKind, opts)

  }).done(function(targetTx) { cb(null, targetTx) }, function(error) { cb(error) })
}

/**
 * @callback TxTranformer~transformTx
 * @param {?Error} error
 * @param {(OpeationalTx|ComposedTx|Transaction)} tx
 */

/**
 * Transform a transaction tx into another type of transaction defined by targetKind.
 *
 * AssetTx  -> OperationalTx -> ComposedTx -> RawTx -> Transaction
 * "simple" -> "operational" -> "composed" -> "raw" -> ("signed" or "partially-signed")
 *
 * @param {(AssetTx|OperationalTx|ComposedTx)} tx
 * @param {string} targetKind
 * @param {Object} [opts] Required if targetKind is signed
 * @param {string} [opts.seedHex]
 * @param {Wallet} [opts.wallet]
 * @param {TxTranformer~transformTx} cb
 */
function transformTx(tx, targetKind, opts, cb) {
  if (_.isUndefined(cb)) {
    cb = opts
    opts = undefined
  }

  if (_.isUndefined(opts))
    opts = {}

  verify.string(targetKind)
  verify.object(opts)
  verify.function(cb)

  Q.fcall(function() {
    var currentKind = classifyTx(tx)
    if (currentKind === targetKind)
      return tx
    if (currentKind === 'signed' && targetKind === 'partially-signed')
      return tx

    if (currentKind === 'asset')
      return Q.nfcall(transformAssetTx, tx, targetKind, opts)

    if (currentKind === 'operational')
      return Q.nfcall(transformOperationalTx, tx, targetKind, opts)

    if (currentKind === 'composed')
      return Q.nfcall(transformComposedTx, tx, targetKind, opts)

    if (currentKind === 'raw')
      return Q.nfcall(transformRawTx, tx, targetKind, opts)

    throw new Error('targetKind is not recognized')

  }).done(function(targetTx) { cb(null, targetTx) }, function(error) { cb(error) })
}


module.exports = transformTx
