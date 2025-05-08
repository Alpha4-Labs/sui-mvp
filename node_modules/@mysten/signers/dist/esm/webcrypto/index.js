var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var _publicKey;
import { Signer } from "@mysten/sui/cryptography";
import { Secp256r1PublicKey } from "@mysten/sui/keypairs/secp256r1";
import { secp256r1 } from "@noble/curves/p256";
function getCompressedPublicKey(publicKey) {
  const rawBytes = new Uint8Array(publicKey);
  const x = rawBytes.slice(1, 33);
  const y = rawBytes.slice(33, 65);
  const prefix = (y[31] & 1) === 0 ? 2 : 3;
  const compressed = new Uint8Array(Secp256r1PublicKey.SIZE);
  compressed[0] = prefix;
  compressed.set(x, 1);
  return compressed;
}
const _WebCryptoSigner = class _WebCryptoSigner extends Signer {
  constructor(privateKey, publicKey) {
    super();
    __privateAdd(this, _publicKey);
    this.privateKey = privateKey;
    __privateSet(this, _publicKey, new Secp256r1PublicKey(publicKey));
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
    const signature = secp256r1.Signature.fromCompact(new Uint8Array(rawSignature));
    return signature.normalizeS().toCompactRawBytes();
  }
};
_publicKey = new WeakMap();
let WebCryptoSigner = _WebCryptoSigner;
export {
  WebCryptoSigner
};
//# sourceMappingURL=index.js.map
