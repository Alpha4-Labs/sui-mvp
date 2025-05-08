import { secp256r1 } from "@noble/curves/p256";
import { secp256k1 } from "@noble/curves/secp256k1";
import { ASN1Construction, ASN1TagClass, DERElement } from "asn1-ts";
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
  const derElement = new DERElement();
  derElement.fromBytes(encodedData);
  if (!(derElement.tagClass === ASN1TagClass.universal && derElement.construction === ASN1Construction.constructed)) {
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
  const derElement = new DERElement();
  derElement.fromBytes(signature);
  const [r, s] = derElement.toJSON();
  switch (keyScheme) {
    case "Secp256k1":
      return new secp256k1.Signature(BigInt(r), BigInt(s)).normalizeS().toCompactRawBytes();
    case "Secp256r1":
      return new secp256r1.Signature(BigInt(r), BigInt(s)).normalizeS().toCompactRawBytes();
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
export {
  DER_BIT_STRING_LENGTH,
  DER_BYTES_LENGTH,
  compressPublicKeyClamped,
  getConcatenatedSignature,
  publicKeyFromDER
};
//# sourceMappingURL=utils.js.map
