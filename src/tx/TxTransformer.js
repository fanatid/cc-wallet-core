var _ = require('lodash')
var Q = require('q')
var bitcore = require('bitcore-lib')
var cclib = require('coloredcoinjs-lib')

var errors = require('../errors')
var AssetTx = require('./AssetTx')
var OperationalTx = require('./OperationalTx')
var RawTx = require('./RawTx')

/**
 * For a given transaction tx, returns a string that represents
 *  the type of transaction (asset, operational, composed, signed) that it is
 *
 * @name transformTx~classifyTx
 * @param {(AssetTx|OperationalTx|cclib.tx.Composed|RawTx|bitcore.Transaction)} tx
 * @return {?string}
 */
function classifyTx (tx) {
  if (tx instanceof AssetTx) {
    return 'asset'
  }

  if (tx instanceof OperationalTx) {
    return 'operational'
  }

  if (tx instanceof cclib.tx.Composed) {
    return 'composed'
  }

  if (tx instanceof RawTx) {
    return 'raw'
  }

  if (tx instanceof bitcore.Transaction) {
    if (tx.isFullySigned()) {
      return 'signed'
    }

    return 'partially-signed'
  }

  return null
}

/**
 * @callback transformTx~transformAssetTxCallback
 * @param {?Error} error
 * @param {OperationalTx} operationalTx
 */

/**
 * Takes a AssetTx assetTx and returns a transaction
 *  of type targetKind which is one of (operational, composed, signed)
 *
 * @name transformTx~transformAssetTx
 * @param {AssetTx} assetTx
 * @param {string} targetKind
 * @param {Object} opts
 * @param {transformTx~transformAssetTxCallback} cb
 */
function transformAssetTx (assetTx, targetKind, opts, cb) {
  Q.fcall(function () {
    if (['operational', 'composed', 'raw', 'signed'].indexOf(targetKind) === -1) {
      throw new errors.TargetKindIsNotReachableError('AssetTx to ' + targetKind)
    }

    return assetTx.isMonoColor()
  })
  .then(function (isMonoColor) {
    if (!isMonoColor) {
      throw new errors.MultiColorNotSupportedError('Attempt transform multi-color AssetTx')
    }

    return Q.ninvoke(assetTx, 'makeOperationalTx')
  })
  .then(function (operationalTx) {
    return Q.nfcall(transformTx, operationalTx, targetKind, opts)
  })
  .then(function (targetTx) { cb(null, targetTx) },
        function (error) { cb(error) })
}

/**
 * @callback transformTx~transformOperationalTxCallback
 * @param {?Error} error
 * @param {cclib.tx.Composed} composedTx
 */

/**
 * Takes a OperationalTx operationalTx and returns a transaction
 *  of type targetKind which is one of (composed, signed)
 *
 * @name transformTx~transformOperationalTx
 * @param {OperationalTx} operationalTx
 * @param {string} targetKind
 * @param {Object} opts
 * @param {transformTx~transformOperationalTxCallback} cb
 */
function transformOperationalTx (operationalTx, targetKind, opts, cb) {
  Q.fcall(function () {
    if (['composed', 'raw', 'signed'].indexOf(targetKind) === -1) {
      throw new errors.TargetKindIsNotReachableError('OperationalTx to ' + targetKind)
    }

    if (!operationalTx.isMonoColor()) {
      throw new errors.MultiColorNotSupportedError('Attempt transform multi-color OperationalTx')
    }

    var composer = operationalTx.getTargets()[0].getColorDefinition().constructor.makeComposedTx
    if (_.isUndefined(composer)) {
      throw new errors.ComposerFunctionNotFoundError()
    }

    return composer(operationalTx)
  })
  .then(function (composedTx) {
    return Q.nfcall(transformTx, composedTx, targetKind, opts)
  })
  .then(function (targetTx) { cb(null, targetTx) },
        function (error) { cb(error) })
}

/**
 * @callback transformTx~transformComposedTxCallback
 * @param {?Error} error
 * @param {bitcore.Transaction} tx
 */

/**
 * Takes a ComposedTx composedTx and returns a transaction
 *  of type targetKind which is one of (raw, signed)
 *
 * @name transformTx~transformComposedTx
 * @param {cclib.ComposedTx} composedTx
 * @param {string} targetKind
 * @param {Object} opts
 * @param {transformTx~transformComposedTxCallback} cb
 */
function transformComposedTx (composedTx, targetKind, opts, cb) {
  Q.fcall(function () {
    if (['raw', 'signed'].indexOf(targetKind) === -1) {
      throw new errors.TargetKindIsNotReachableError('ComposedTx to ' + targetKind)
    }

    return RawTx.fromComposedTx(composedTx)
  })
  .then(function (rawTx) {
    return Q.nfcall(transformTx, rawTx, targetKind, opts)
  })
  .then(function (targetTx) { cb(null, targetTx) },
        function (error) { cb(error) })
}

/**
 * @callback transformTx~transformRawTxCallback
 * @param {?Error} error
 * @param {bitcore.Transaction} tx
 */

/**
 * Takes a RawTx rawTx and returns a transaction
 *  of type targetKind which is one of (signed)
 *
 * @name transformTx~transformRawTx
 * @param {RawTx} rawTx
 * @param {string} targetKind
 * @param {Object} opts
 * @param {transformTx~transformRawTxCallback} cb
 */
function transformRawTx (rawTx, targetKind, opts, cb) {
  Q.fcall(function () {
    if (['signed', 'partially-signed'].indexOf(targetKind) === -1) {
      throw new errors.TargetKindIsNotReachableError('RawTx to ' + targetKind)
    }

    return Q.ninvoke(rawTx, 'sign', opts.wallet, opts.seedHex, opts.signingOnly)
  })
  .then(function () {
    var allowIncomplete = (targetKind === 'partially-signed')
    return rawTx.toTransaction(allowIncomplete)
  })
  .then(function (signedTx) {
    return Q.nfcall(transformTx, signedTx, targetKind, opts)
  })
  .then(function (targetTx) { cb(null, targetTx) },
        function (error) { cb(error) })
}

/**
 * @callback transformTx~callback
 * @param {?Error} error
 * @param {(OpeationalTx|cclib.tx.Composed|RawTx|bitcore.Transaction)} tx
 */

/**
 * Transform a transaction tx into another type of transaction defined by targetKind.
 *
 * AssetTx  -> OperationalTx -> ComposedTx -> RawTx -> Transaction
 * "simple" -> "operational" -> "composed" -> "raw" -> ("signed" or "partially-signed")
 *
 * @param {(AssetTx|OperationalTx|cclib.tx.Composed|RawTx|bitcore.Transaction)} tx
 * @param {string} targetKind
 * @param {Object} [opts] Required if targetKind is signed
 * @param {string} [opts.seedHex]
 * @param {Wallet} [opts.wallet]
 * @param {number[]} [opts.signingOnly] Sign only given indexes
 * @param {transformTx~callback} cb
 */
function transformTx (tx, targetKind, opts, cb) {
  if (_.isUndefined(cb)) {
    cb = opts
    opts = undefined
  }

  if (_.isUndefined(opts)) {
    opts = {}
  }

  Q.fcall(function () {
    var currentKind = classifyTx(tx)
    if (currentKind === null) {
      throw new errors.TxKindIsNotRecognizedError()
    }

    if ([targetKind, 'signed', 'partially-signed'].indexOf(currentKind) !== -1) {
      return tx
    }

    if (currentKind === 'asset') {
      return Q.nfcall(transformAssetTx, tx, targetKind, opts)
    }

    if (currentKind === 'operational') {
      return Q.nfcall(transformOperationalTx, tx, targetKind, opts)
    }

    if (currentKind === 'composed') {
      return Q.nfcall(transformComposedTx, tx, targetKind, opts)
    }

    if (currentKind === 'raw') {
      return Q.nfcall(transformRawTx, tx, targetKind, opts)
    }
  })
  .then(function (targetTx) { cb(null, targetTx) },
        function (error) { cb(error) })
}

module.exports = transformTx
