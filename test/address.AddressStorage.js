var expect = require('chai').expect

var ccWallet = require('../')
var AddressStorage = ccWallet.address.AddressStorage

describe('address.AddressStorage', function () {
  var storage
  // master key:
  // xprv9s21ZrQH143K2JF8RafpqtKiTbsbaxEeUaMnNHsm5o6wCW3z8ySyH4UxFVSfZ8n7ESu7fgir8imbZKLYVBxFPND1pniTZ81vKfd45EHKX73
  var pubKeyHex1 = '021c10af30f8380f1ff05a02e10a69bd323a7305c43dc461f79c2b27c13532a12c'
  var pubKeyHex2 = '0375d65343d5dcf4527cf712168b41059cb1df513ba89b44108899835329eb643c'

  beforeEach(function () {
    storage = new AddressStorage()
  })

  afterEach(function () {
    storage.clear()
  })

  it('add throw UniqueConstraint for account, chain and index', function () {
    storage.add({chain: 0, index: 0, pubKey: pubKeyHex1})
    expect(function () {
      storage.add({chain: 0, index: 0, pubKey: pubKeyHex2})
    }).to.throw(ccWallet.errors.AlreadyExistsError)
  })

  it('add throw UniqueConstraint for pubKey', function () {
    storage.add({chain: 0, index: 0, pubKey: pubKeyHex1})
    expect(function () {
      storage.add({chain: 0, index: 1, pubKey: pubKeyHex1})
    }).to.throw(ccWallet.errors.AlreadyExistsError)
  })

  it('getAll', function () {
    storage.add({chain: 0, index: 0, pubKey: pubKeyHex1})
    storage.add({chain: 1, index: 0, pubKey: pubKeyHex2})
    var pubKeys = storage.getAll(0)
    expect(pubKeys).to.deep.equal([{account: 0, chain: 0, index: 0, pubKey: pubKeyHex1}])
  })
})
