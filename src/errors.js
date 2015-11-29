var _ = require('lodash')
var errors = require('coloredcoinjs-lib').errors
var createError = errors.createError || require('errno').create

/**
 * Error
 *  +-- ColoredCoin
 *       +-- AlreadyExistsError
 *       +-- CoinColorValueError
 *       +-- IncompatibilityError
 *       |    +-- ColoredFeeEstimatorError
 *       |    +-- NetworkNotSupportVerificationMethodsError
 *       +-- InsufficientFundsError
 *       +-- MultiAssetTransactionNotSupportedError
 *       +-- MultiColorNotSupportedError
 *       +-- NetworkError
 *       |    +-- NetworkChainError
 *       |    +-- NetworkElectrumError
 *       |    +-- NetworkGetTxError
 *       |    +-- NetworkSendTxError
 *       +-- NotFoundError
 *       |    +-- AssetNotFoundError
 *       |    +-- CoinNotFoundError
 *       |    +-- ComposerFunctionNotFoundError
 *       |    +-- HeaderNotFoundError
 *       |    +-- TxNotFoundError
 *       +-- VerifiedBlockchainError
 *       |    +-- VerifyChunkError
 *       |    +-- VerifyHeaderError
 *       |    +-- VerifyTxError
 *       +-- ToposortError
 *       +-- TxTransformError
 *       |    +-- TxKindIsNotRecognizedError
 *       |    +-- TargetKindIsNotReachableError
 *       +-- WalletAlreadyInitializedError
 *       +-- WalletNotInitializedError
 */

/**
 * @member {Object} external:coloredcoinjs-lib.errors
 */

/**
 * @member {function} external:coloredcoinjs-lib.errors.ColoredCoinError
 */
var ColoredCoinError = errors.ColoredCoin

/**
 * @class IncompatibilityError
 * @extends {external:coloredcoinjs-lib.errors.ColoredCoinError}
 */
var IncompatibilityError = createError('IncompatibilityError', ColoredCoinError)

/**
 * @class AlreadyExistsError
 * @extends {external:coloredcoinjs-lib.errors.ColoredCoinError}
 */
var AlreadyExistsError = createError('AlreadyExistsError', ColoredCoinError)

/**
 * @class CoinColorValueError
 * @extends {external:coloredcoinjs-lib.errors.ColoredCoinError}
 */
var CoinColorValueError = createError('CoinColorValueError', ColoredCoinError)

/**
 * @class ColoredFeeEstimatorError
 * @extends {external:coloredcoinjs-lib.errors.IncompatibilityError}
 */
var ColoredFeeEstimatorError = createError('ColoredFeeEstimatorError', IncompatibilityError)

/**
 * @class NetworkNotSupportVerificationMethodsError
 * @extends {external:coloredcoinjs-lib.errors.IncompatibilityError}
 */
var NetworkNotSupportVerificationMethodsError = createError(
  'NetworkNotSupportVerificationMethodsError', IncompatibilityError)

/**
 * @class InsufficientFundsError
 * @extends {external:coloredcoinjs-lib.errors.ColoredCoinError}
 */
var InsufficientFundsError = createError('InsufficientFundsError', ColoredCoinError)

/**
 * @class MultiAssetTransactionNotSupportedError
 * @extends {external:coloredcoinjs-lib.errors.ColoredCoinError}
 */
var MultiAssetTransactionNotSupportedError = createError('MultiAssetTransactionNotSupportedError', ColoredCoinError)

/**
 * @class MultiColorNotSupportedError
 * @extends {external:coloredcoinjs-lib.errors.ColoredCoinError}
 */
var MultiColorNotSupportedError = createError('MultiColorNotSupportedError', ColoredCoinError)

/**
 * @class NetworkError
 * @extends {external:coloredcoinjs-lib.errors.ColoredCoinError}
 */
var NetworkError = createError('NetworkError', ColoredCoinError)

/**
 * @class NetworkChainError
 * @extends {NetworkError}
 */
var NetworkChainError = createError('NetworkChainError', NetworkError)

/**
 * @class NetworkElectrumError
 * @extends {NetworkError}
 */
var NetworkElectrumError = createError('NetworkElectrumError', NetworkError)

/**
 * @class NetworkGetTxError
 * @extends {NetworkError}
 */
var NetworkGetTxError = createError('NetworkGetTxError', NetworkError)

/**
 * @class NetworkSendTxError
 * @extends {NetworkError}
 */
var NetworkSendTxError = createError('NetworkSendTxError', NetworkError)

/**
 * @class NotFoundError
 * @extends {external:coloredcoinjs-lib.errors.ColoredCoinError}
 */
var NotFoundError = createError('NotFoundError', ColoredCoinError)

/**
 * @class AssetNotFoundError
 * @extends {NotFoundError}
 */
var AssetNotFoundError = createError('AssetNotFoundError', NotFoundError)

/**
 * @class CoinNotFoundError
 * @extends {NotFoundError}
 */
var CoinNotFoundError = createError('CoinNotFoundError', NotFoundError)

/**
 * @class ComposerFunctionNotFoundError
 * @extends {NotFoundError}
 */
var ComposerFunctionNotFoundError = createError('ComposerFunctionNotFoundError', NotFoundError)

/**
 * @class HeaderNotFoundError
 * @extends {NotFoundError}
 */
var HeaderNotFoundError = createError('HeaderNotFoundError', NotFoundError)

/**
 * @class TxNotFoundError
 * @extends {NotFoundError}
 */
var TxNotFoundError = createError('TxNotFoundError', NotFoundError)

/**
 * @class VerifiedBlockchainError
 * @extends {external:coloredcoinjs-lib.errors.ColoredCoinError}
 */
var VerifiedBlockchainError = createError('VerifiedBlockchainError', ColoredCoinError)

/**
 * @class VerifiedBlockchainError
 * @extends {external:coloredcoinjs-lib.errors.ColoredCoinError}
 */
var VerifyChunkError = createError('VerifyChunkError', VerifiedBlockchainError)

/**
 * @class VerifyHeaderError
 * @extends {VerifiedBlockchainError}
 */
var VerifyHeaderError = createError('VerifyHeaderError', VerifiedBlockchainError)

/**
 * @class VerifyTxError
 * @extends {VerifiedBlockchainError}
 */
var VerifyTxError = createError('VerifyTxError', VerifiedBlockchainError)

/**
 * @class ToposortError
 * @extends {external:coloredcoinjs-lib.errors.ColoredCoinError}
 */
var ToposortError = createError('ToposortError', ColoredCoinError)

/**
 * @class TxTransformError
 * @extends {external:coloredcoinjs-lib.errors.ColoredCoinError}
 */
var TxTransformError = createError('TxTransformError', ColoredCoinError)

/**
 * @class TxKindIsNotRecognizedError
 * @extends {TxTransformError}
 */
var TxKindIsNotRecognizedError = createError('TxKindIsNotRecognizedError', TxTransformError)

/**
 * @class TargetKindIsNotReachableError
 * @extends {TxTransformError}
 */
var TargetKindIsNotReachableError = createError('TargetKindIsNotReachableError', TxTransformError)

/**
 * @class WalletAlreadyInitializedError
 * @extends {external:coloredcoinjs-lib.errors.ColoredCoinError}
 */
var WalletAlreadyInitializedError = createError('WalletAlreadyInitializedError', ColoredCoinError)

/**
 * @class WalletNotInitializedError
 * @extends {external:coloredcoinjs-lib.errors.ColoredCoinError}
 */
var WalletNotInitializedError = createError('WalletNotInitializedError', ColoredCoinError)

module.exports = _.extend(errors, {
  AlreadyExistsError: AlreadyExistsError,
  CoinColorValueError: CoinColorValueError,
  ColoredFeeEstimatorError: ColoredFeeEstimatorError,
  NetworkNotSupportVerificationMethodsError: NetworkNotSupportVerificationMethodsError,
  InsufficientFundsError: InsufficientFundsError,
  MultiAssetTransactionNotSupportedError: MultiAssetTransactionNotSupportedError,
  MultiColorNotSupportedError: MultiColorNotSupportedError,
  NetworkError: NetworkError,
  NetworkChainError: NetworkChainError,
  NetworkElectrumError: NetworkElectrumError,
  NetworkGetTxError: NetworkGetTxError,
  NetworkSendTxError: NetworkSendTxError,
  NotFoundError: NotFoundError,
  AssetNotFoundError: AssetNotFoundError,
  CoinNotFoundError: CoinNotFoundError,
  ComposerFunctionNotFoundError: ComposerFunctionNotFoundError,
  HeaderNotFoundError: HeaderNotFoundError,
  TxNotFoundError: TxNotFoundError,
  VerifiedBlockchainError: VerifiedBlockchainError,
  VerifyChunkError: VerifyChunkError,
  VerifyHeaderError: VerifyHeaderError,
  VerifyTxError: VerifyTxError,
  ToposortError: ToposortError,
  TxTransformError: TxTransformError,
  TxKindIsNotRecognizedError: TxKindIsNotRecognizedError,
  TargetKindIsNotReachableError: TargetKindIsNotReachableError,
  WalletAlreadyInitializedError: WalletAlreadyInitializedError,
  WalletNotInitializedError: WalletNotInitializedError
})
