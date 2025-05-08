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
var EnokiKeypair_exports = {};
__export(EnokiKeypair_exports, {
  EnokiKeypair: () => EnokiKeypair,
  EnokiPublicKey: () => EnokiPublicKey
});
module.exports = __toCommonJS(EnokiKeypair_exports);
var import_cryptography = require("@mysten/sui/cryptography");
var import_zklogin = require("@mysten/sui/zklogin");
var _proof, _maxEpoch, _ephemeralKeypair, _publicKey;
class EnokiPublicKey extends import_zklogin.ZkLoginPublicIdentifier {
}
class EnokiKeypair extends import_cryptography.Signer {
  constructor(input) {
    super();
    __privateAdd(this, _proof);
    __privateAdd(this, _maxEpoch);
    __privateAdd(this, _ephemeralKeypair);
    __privateAdd(this, _publicKey);
    __privateSet(this, _proof, input.proof);
    __privateSet(this, _maxEpoch, input.maxEpoch);
    __privateSet(this, _ephemeralKeypair, input.ephemeralKeypair);
    __privateSet(this, _publicKey, EnokiPublicKey.fromProof(input.address, input.proof));
  }
  async sign(data) {
    return __privateGet(this, _ephemeralKeypair).sign(data);
  }
  async signPersonalMessage(bytes) {
    const { bytes: signedBytes, signature: userSignature } = await __privateGet(this, _ephemeralKeypair).signPersonalMessage(bytes);
    const zkSignature = (0, import_zklogin.getZkLoginSignature)({
      inputs: __privateGet(this, _proof),
      maxEpoch: __privateGet(this, _maxEpoch),
      userSignature
    });
    return {
      bytes: signedBytes,
      signature: zkSignature
    };
  }
  async signTransaction(bytes) {
    const { bytes: signedBytes, signature: userSignature } = await __privateGet(this, _ephemeralKeypair).signTransaction(bytes);
    const zkSignature = (0, import_zklogin.getZkLoginSignature)({
      inputs: __privateGet(this, _proof),
      maxEpoch: __privateGet(this, _maxEpoch),
      userSignature
    });
    return {
      bytes: signedBytes,
      signature: zkSignature
    };
  }
  getKeyScheme() {
    return __privateGet(this, _ephemeralKeypair).getKeyScheme();
  }
  getPublicKey() {
    return __privateGet(this, _publicKey);
  }
}
_proof = new WeakMap();
_maxEpoch = new WeakMap();
_ephemeralKeypair = new WeakMap();
_publicKey = new WeakMap();
//# sourceMappingURL=EnokiKeypair.js.map
