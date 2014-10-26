var memdown = require('memdown')
var leveljs = require('level-js')
var levelup = require('levelup')
var _ = require('lodash')
var Q = require('q')

var verify = require('../verify')


var StorageName = 'ccWalletBlockchainHeaders'

/**
 * @callback HeaderStorage~constructor
 * @param {?Error} error
 */

/**
 * @class HeaderStorage
 * @param {HeaderStorage~constructor} readyCallback
 */
function HeaderStorage(readyCallback) {
  verify.function(readyCallback)

  var opts = {db: typeof window === 'undefined' ? memdown : leveljs}
  levelup(StorageName, opts, function(error, db) {
    if (error === null)
      this._db = db

    readyCallback(error)
  }.bind(this))
}

/**
 * @callback HeaderStorage~clear
 * @param {?Error} error
 */

/**
 * @param {HeaderStorage~clear} cb
 */
HeaderStorage.prototype.clear = function(cb) {
  verify.function(cb)

  var deferred = Q.defer()

  var ws = this._db.createWriteStream({ type: 'del' })
  ws.on('error', deferred.reject)
  ws.on('close', deferred.resolve)

  this._db.createKeyStream()
    .on('error', function(error) {
      deferred.reject(error)
      ws.end()
    })
    .on('data', function(key) { ws.write({key: key}) })
    .on('end', function() { ws.end() })

  deferred.promise.done(function() { cb(null) }, function(error) { cb(error) })
}

/**
 * @callback HeaderStorage~count
 * @param {?Error} error
 * @param {number} count
 */

/**
 * @param {HeaderStorage~count} cb
 */
HeaderStorage.prototype.count = function(cb) {
  var count = 0

  this._db.createKeyStream()
    .on('error', cb)
    .on('data', function() { count += 1 })
    .on('end', function() {
      cb(null, count)
    })
}

/**
 * @callback HeaderStorage~put
 * @param {?Error} error
 */

/**
 * @param {number} height
 * @param {Buffer} header
 * @param {HeaderStorage~put} cb
 */
HeaderStorage.prototype.put = function(height, header, cb) {
  verify.number(height)
  verify.buffer(header)
  verify.length(header, 80)
  verify.function(cb)

  this._db.put(height, header, function(error) {
    cb(_.isUndefined(error) ? null : error)
  })
}

/**
 * @callback HeaderStorage~get
 * @param {?Error} error
 * @param {Buffer} rawHeader
 */

/**
 * @param {number} height
 * @param {HeaderStorage~get} cb
 */
HeaderStorage.prototype.get = function(height, cb) {
  verify.number(height)
  verify.function(cb)

  this._db.get(height, function(error, ab) {
    if (error)
      return cb(error)

    var result = new Buffer(80)
    for (var i = 0; i < 80; ++i)
      result[i] = ab[i]

    cb(null, result)
  })
}

/**
 * @callback HeaderStorage~popHeader
 * @param {?Error} error
 */

/**
 * @param {number} height
 * @param {HeaderStorage~popHeader} cb
 */
HeaderStorage.prototype.del = function(height, cb) {
  verify.function(cb)

  this._db.del(height, function(error) {
    cb(_.isUndefined(error) ? null : error)
  })
}


module.exports = HeaderStorage
