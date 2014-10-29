var memdown = require('memdown')
var leveljs = require('level-js')
var levelup = require('levelup')
var Q = require('q')

var verify = require('../verify')


var StorageName = 'ccWalletBlockchainHeaders'

/**
 * @class HeaderStorage
 */
function HeaderStorage() {}

/**
 * @callback HeaderStorage~open
 * @param {?Error} error
 */

/**
 * @param {HeaderStorage~open} cb
 */
HeaderStorage.prototype.open = function(cb) {
  verify.function(cb)

  var opts = {db: typeof window === 'undefined' ? memdown : leveljs}
  levelup(StorageName, opts, function(error, db) {
    if (error === null)
      this._db = db

    cb(error)
  }.bind(this))
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
 * @param {{height: number, header: Buffer}} data
 * @param {HeaderStorage~put} cb
 */
HeaderStorage.prototype.put = function(data, cb) {
  verify.array(data)
  data.forEach(function(d) {
    verify.number(d.height)
    verify.buffer(d.header)
    verify.length(d.header, 80)
  })
  verify.function(cb)

  var ws = this._db.createWriteStream({ type: 'put' })
  ws.on('error', cb)
  ws.on('close', function() { cb(null) })

  data.forEach(function(d) { ws.write({ key: d.height, value: d.header }) })

  ws.end()
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
 * @param {number[]} heights
 * @param {HeaderStorage~popHeader} cb
 */
HeaderStorage.prototype.del = function(heights, cb) {
  verify.array(heights)
  heights.forEach(verify.number)
  verify.function(cb)

  var ws = this._db.createWriteStream({ type: 'del' })
  ws.on('error', cb)
  ws.on('close', function() { cb(null) })

  heights.forEach(function(height) { ws.write({ key: height }) })

  ws.end()
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


module.exports = HeaderStorage
