var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var _proof, _maxEpoch, _ephemeralKeypair, _publicKey;
import { Signer } from "@mysten/sui/cryptography";
import { getZkLoginSignature, ZkLoginPublicIdentifier } from "@mysten/sui/zklogin";
class EnokiPublicKey extends ZkLoginPublicIdentifier {
}
class EnokiKeypair extends Signer {
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
    const zkSignature = getZkLoginSignature({
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
    const zkSignature = getZkLoginSignature({
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
export {
  EnokiKeypair,
  EnokiPublicKey
};
//# sourceMappingURL=EnokiKeypair.js.map
