"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = encodeCharacterString;
const der_1 = __importDefault(require("../../../codecs/der"));
const values_1 = require("../../../values");
const encodeSequence_1 = __importDefault(require("./encodeSequence"));
function encodeCharacterString(value) {
    return (0, encodeSequence_1.default)([
        value.identification,
        new der_1.default(values_1.ASN1TagClass.universal, values_1.ASN1Construction.primitive, values_1.ASN1UniversalType.octetString, value.stringValue),
    ]);
}
