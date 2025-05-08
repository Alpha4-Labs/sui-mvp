"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var webcrypto_exports = {};
__export(webcrypto_exports, {
  WebCryptoSigner: () => WebCryptoSigner
});
module.exports = __toCommonJS(webcrypto_exports);
var import_cryptography = require("@mysten/sui/cryptography");
var import_secp256r1 = require("@mysten/sui/keypairs/secp256r1");
var import_p256 = require("@noble/curves/p256");
var _publicKey;
function getCompressedPublicKey(publicKey) {
  const rawBytes = new Uint8Array(publicKey);
  const x = rawBytes.slice(1, 33);
  const y = rawBytes.slice(33, 65);
  const prefix = (y[31] & 1) === 0 ? 2 : 3;
  const compressed = new Uint8Array(import_secp256r1.Secp256r1PublicKey.SIZE);
  compressed[0] = prefix;
  compressed.set(x, 1);
  return compressed;
}
const _WebCryptoSigner = class _WebCryptoSigner extends import_cryptography.Signer {
  constructor(privateKey, publicKey) {
    super();
    __privateAdd(this, _publicKey);
    this.privateKey = privateKey;
    __privateSet(this, _publicKey, new import_secp256r1.Secp256r1PublicKey(publicKey));
  }
  static async generate({ extractable = false } = {}) {
    const keypair = await globalThis.crypto.subtle.generateKey(
      {
        name: "ECDSA",
        namedCurve: "P-256"
      },
      extractable,
      ["sign", "verify"]
    );
    const publicKey = await globalThis.crypto.subtle.exportKey("raw", keypair.publicKey);
    return new _WebCryptoSigner(
      keypair.privateKey,
      getCompressedPublicKey(new Uint8Array(publicKey))
    );
  }
  /**
   * Imports a keypair using the value returned by `export()`.
   */
  static import(data) {
    return new _WebCryptoSigner(data.privateKey, data.publicKey);
  }
  getKeyScheme() {
    return "Secp256r1";
  }
  /**
   * Exports the keypair so that it can be stored in IndexedDB.
   */
  export() {
    const exportedKeypair = {
      privateKey: this.privateKey,
      publicKey: __privateGet(this, _publicKey).toRawBytes()
    };
    Object.defineProperty(exportedKeypair, "toJSON", {
      enumerable: false,
      value: () => {
        throw new Error(
          "The exported keypair must not be serialized. It must be stored in IndexedDB directly."
        );
      }
    });
    return exportedKeypair;
  }
  getPublicKey() {
    return __privateGet(this, _publicKey);
  }
  async sign(bytes) {
    const rawSignature = await globalThis.crypto.subtle.sign(
      {
        name: "ECDSA",
        hash: "SHA-256"
      },
      this.privateKey,
      bytes
    );
    const signature = import_p256.secp256r1.Signature.fromCompact(new Uint8Array(rawSignature));
    return signature.normalizeS().toCompactRawBytes();
  }
};
_publicKey = new WeakMap();
let WebCryptoSigner = _WebCryptoSigner;
//# sourceMappingURL=index.js.map
