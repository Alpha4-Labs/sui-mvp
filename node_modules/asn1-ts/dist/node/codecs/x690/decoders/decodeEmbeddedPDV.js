"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = decodeEmbeddedPDV;
const EmbeddedPDV_1 = __importDefault(require("../../../types/EmbeddedPDV"));
const decodeSequence_1 = __importDefault(require("../../der/decoders/decodeSequence"));
function decodeEmbeddedPDV(value) {
    const components = (0, decodeSequence_1.default)(value);
    const identification = components[0];
    const dataValue = components[1].octetString;
    return new EmbeddedPDV_1.default(identification, dataValue);
}
