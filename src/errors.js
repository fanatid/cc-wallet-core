var _ = require('lodash')
var errors = require('./cclib').errors
var createError = errors.createError || require('errno').create


/**
 * ColoredCoinError
 *  +-- AlreadyExistsError
 *  +-- CoinColorValueError
 *  +-- IncompatibilityError
 *  |    +-- ColoredFeeEstimatorError
 *  |    +-- NetworkNotSupportVerificationMethodsError
 *  +-- InsufficientFundsError
 *  +-- MultiAssetTransactionNotSupportedError
 *  +-- MultiColorNotSupportedError
 *  +-- NetworkError
 *  |    +-- NetworkChainError
 *  |    +-- NetworkElectrumError
 *  |    +-- NetworkGetTxError
 *  |    +-- NetworkSendTxError
 *  +-- NotFoundError
 *  |    +-- AssetNotFoundError
 *  |    +-- ComposerFunctionNotFoundError
 *  |    +-- HeaderNotFoundError
 *  |    +-- TxNotFoundError
 *  +-- VerifiedBlockchainError
 *  |    +-- VerifyChunkError
 *  |    +-- VerifyHeaderError
 *  |    +-- VerifyTxError
 *  +-- ToposortError
 *  +-- TxTransformError
 *  |    +-- TxKindIsNotRecognizedError
 *  |    +-- TargetKindIsNotReachableError
 *  +-- VerifyTypeError
 *  |    +-- VerifyColorDefinitionTypeError
 *  |    +-- VerifyPowerError
 *  |    +-- VerifySeedHexError
 *  +-- WalletAlreadyInitializedError
 *  +-- WalletNotInitializedError
 */

var ColoredCoinError = errors.ColoredCoinError
var IncompatibilityError = errors.IncompatibilityError
var VerifyTypeError = errors.VerifyTypeError


/**
 */
var AlreadyExistsError = createError('AlreadyExistsError', ColoredCoinError)

/**
 */
var CoinColorValueError = createError('CoinColorValueError', ColoredCoinError)

/**
 */
var ColoredFeeEstimatorError = createError('ColoredFeeEstimatorError', IncompatibilityError)

/**
 */
var NetworkNotSupportVerificationMethodsError = createError(
  'NetworkNotSupportVerificationMethodsError', IncompatibilityError)

/**
 */
var InsufficientFundsError = createError('InsufficientFundsError', ColoredCoinError)

/**
 */
var MultiAssetTransactionNotSupportedError = createError('MultiAssetTransactionNotSupportedError', ColoredCoinError)

/**
 */
var MultiColorNotSupportedError = createError('MultiColorNotSupportedError', ColoredCoinError)

/**
 */
var NetworkError = createError('NetworkError', ColoredCoinError)

/**
 */
var NetworkChainError = createError('NetworkChainError', NetworkError)

/**
 */
var NetworkElectrumError = createError('NetworkElectrumError', NetworkError)

/**
 */
var NetworkGetTxError = createError('NetworkGetTxError', NetworkError)

/**
 */
var NetworkSendTxError = createError('NetworkSendTxError', NetworkError)

/**
 */
var NotFoundError = createError('NotFoundError', ColoredCoinError)

/**
 */
var AssetNotFoundError = createError('AssetNotFoundError', NotFoundError)

/**
 */
var ComposerFunctionNotFoundError = createError('ComposerFunctionNotFoundError', NotFoundError)

/**
 */
var HeaderNotFoundError = createError('HeaderNotFoundError', NotFoundError)

/**
 */
var TxNotFoundError = createError('TxNotFoundError', NotFoundError)

/**
 */
var VerifiedBlockchainError = createError('VerifiedBlockchainError', ColoredCoinError)

/**
 */
var VerifyChunkError = createError('VerifyChunkError', VerifiedBlockchainError)

/**
 */
var VerifyHeaderError = createError('VerifyHeaderError', VerifiedBlockchainError)

/**
 */
var VerifyTxError = createError('VerifyTxError', VerifiedBlockchainError)

/**
 */
var ToposortError = createError('ToposortError', ColoredCoinError)

/**
 */
var TxTransformError = createError('TxTransformError', ColoredCoinError)

/**
 */
var TxKindIsNotRecognizedError = createError('TxKindIsNotRecognizedError', TxTransformError)

/**
 */
var TargetKindIsNotReachableError = createError('TargetKindIsNotReachableError', TxTransformError)

/**
 */
var VerifyColorDefinitionTypeError = createError('VerifyColorDefinitionTypeError', VerifyTypeError)

/**
 */
var VerifyPowerError = createError('VerifyPowerError', VerifyTypeError)

/**
 */
var VerifySeedHexError = createError('VerifySeedHexError', VerifyTypeError)

/**
 */
var WalletAlreadyInitializedError = createError('WalletAlreadyInitializedError', ColoredCoinError)

/**
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
  VerifyColorDefinitionTypeError: VerifyColorDefinitionTypeError,
  VerifyPowerError: VerifyPowerError,
  VerifySeedHexError: VerifySeedHexError,
  WalletAlreadyInitializedError: WalletAlreadyInitializedError,
  WalletNotInitializedError: WalletNotInitializedError,
})
