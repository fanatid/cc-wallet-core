var ccwallet = module.exports

//
ccwallet.errors = require('./errors')

//
ccwallet.address = require('./address'),
ccwallet.asset = require('./asset'),
ccwallet.coin = require('./coin'),
ccwallet.history = require('./history'),
ccwallet.tx = require('./tx'),
ccwallet.Wallet = require('./wallet').Wallet,
ccwallet.WalletState = require('./wallet').WalletState,
ccwallet.WalletStateManager = require('./wallet').WalletStateManager

// util
ccwallet.util = {}
ccwallet.util.bitcoin = require('./util/bitcoin')
ccwallet.util.const = require('./util/const')
ccwallet.util.enum = require('./util/enum')
ccwallet.util.OrderedMap = require('./util/ordered-map')
ccwallet.util.tx = require('./util/tx')
