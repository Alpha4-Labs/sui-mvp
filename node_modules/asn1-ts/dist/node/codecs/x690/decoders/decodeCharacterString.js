"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = decodeCharacterString;
const CharacterString_1 = __importDefault(require("../../../types/CharacterString"));
const decodeSequence_1 = __importDefault(require("../../der/decoders/decodeSequence"));
const errors_1 = require("../../../errors");
function decodeCharacterString(value) {
    const components = (0, decodeSequence_1.default)(value);
    if (components.length !== 2) {
        throw new errors_1.ASN1ConstructionError(`CharacterString must contain 2 components, not ${components.length}.`);
    }
    const identification = components[0];
    const stringValue = components[1].octetString;
    return new CharacterString_1.default(identification, stringValue);
}
