"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var utils_exports = {};
__export(utils_exports, {
  DER_BIT_STRING_LENGTH: () => DER_BIT_STRING_LENGTH,
  DER_BYTES_LENGTH: () => DER_BYTES_LENGTH,
  compressPublicKeyClamped: () => compressPublicKeyClamped,
  getConcatenatedSignature: () => getConcatenatedSignature,
  publicKeyFromDER: () => publicKeyFromDER
});
module.exports = __toCommonJS(utils_exports);
var import_p256 = require("@noble/curves/p256");
var import_secp256k1 = require("@noble/curves/secp256k1");
var import_asn1_ts = require("asn1-ts");
const DER_BIT_STRING_LENGTH = 520;
const DER_BYTES_LENGTH = DER_BIT_STRING_LENGTH / 8;
function bitsToBytes(bitsArray) {
  const bytes = new Uint8Array(DER_BYTES_LENGTH);
  for (let i = 0; i < DER_BIT_STRING_LENGTH; i++) {
    if (bitsArray[i] === 1) {
      bytes[Math.floor(i / 8)] |= 1 << 7 - i % 8;
    }
  }
  return bytes;
}
function publicKeyFromDER(derBytes) {
  const encodedData = derBytes;
  const derElement = new import_asn1_ts.DERElement();
  derElement.fromBytes(encodedData);
  if (!(derElement.tagClass === import_asn1_ts.ASN1TagClass.universal && derElement.construction === import_asn1_ts.ASN1Construction.constructed)) {
    throw new Error("Unexpected ASN.1 structure");
  }
  const components = derElement.components;
  const publicKeyElement = components[1];
  if (!publicKeyElement) {
    throw new Error("Public Key not found in the DER structure");
  }
  return compressPublicKeyClamped(publicKeyElement.bitString);
}
function getConcatenatedSignature(signature, keyScheme) {
  if (!signature || signature.length === 0) {
    throw new Error("Invalid signature");
  }
  const derElement = new import_asn1_ts.DERElement();
  derElement.fromBytes(signature);
  const [r, s] = derElement.toJSON();
  switch (keyScheme) {
    case "Secp256k1":
      return new import_secp256k1.secp256k1.Signature(BigInt(r), BigInt(s)).normalizeS().toCompactRawBytes();
    case "Secp256r1":
      return new import_p256.secp256r1.Signature(BigInt(r), BigInt(s)).normalizeS().toCompactRawBytes();
    default:
      throw new Error("Unsupported key scheme");
  }
}
function compressPublicKeyClamped(uncompressedKey) {
  if (uncompressedKey.length !== DER_BIT_STRING_LENGTH) {
    throw new Error("Unexpected length for an uncompressed public key");
  }
  const uncompressedBytes = bitsToBytes(uncompressedKey);
  if (uncompressedBytes[0] !== 4) {
    throw new Error("Public key does not start with 0x04");
  }
  const xCoord = uncompressedBytes.slice(1, 33);
  const yCoordLastByte = uncompressedBytes[64];
  const parityByte = yCoordLastByte % 2 === 0 ? 2 : 3;
  return new Uint8Array([parityByte, ...xCoord]);
}
//# sourceMappingURL=utils.js.map
