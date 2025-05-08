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
var aws_client_exports = {};
__export(aws_client_exports, {
  AwsKmsClient: () => AwsKmsClient
});
module.exports = __toCommonJS(aws_client_exports);
var import_secp256k1 = require("@mysten/sui/keypairs/secp256k1");
var import_secp256r1 = require("@mysten/sui/keypairs/secp256r1");
var import_utils = require("@mysten/sui/utils");
var import_utils2 = require("../utils/utils.js");
var import_aws4fetch = require("./aws4fetch.js");
class AwsKmsClient extends import_aws4fetch.AwsClient {
  constructor(options = {}) {
    if (!options.accessKeyId || !options.secretAccessKey) {
      throw new Error("AWS Access Key ID and Secret Access Key are required");
    }
    if (!options.region) {
      throw new Error("Region is required");
    }
    super({
      region: options.region,
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      service: "kms",
      ...options
    });
  }
  async getPublicKey(keyId) {
    const publicKeyResponse = await this.runCommand("GetPublicKey", { KeyId: keyId });
    if (!publicKeyResponse.PublicKey) {
      throw new Error("Public Key not found for the supplied `keyId`");
    }
    const compressedKey = (0, import_utils2.publicKeyFromDER)((0, import_utils.fromBase64)(publicKeyResponse.PublicKey));
    switch (publicKeyResponse.KeySpec) {
      case "ECC_NIST_P256":
        return new import_secp256r1.Secp256r1PublicKey(compressedKey);
      case "ECC_SECG_P256K1":
        return new import_secp256k1.Secp256k1PublicKey(compressedKey);
      default:
        throw new Error("Unsupported key spec: " + publicKeyResponse.KeySpec);
    }
  }
  async runCommand(command, body, {
    region = this.region
  } = {}) {
    if (!region) {
      throw new Error("Region is required");
    }
    const res = await this.fetch(`https://kms.${region}.amazonaws.com/`, {
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": `TrentService.${command}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    return res.json();
  }
}
//# sourceMappingURL=aws-client.js.map
