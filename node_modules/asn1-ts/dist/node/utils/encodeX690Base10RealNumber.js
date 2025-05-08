"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = encodeX690Base10RealNumber;
const values_1 = require("../values");
const convertTextToBytes_1 = __importDefault(require("./convertTextToBytes"));
function encodeX690Base10RealNumber(value) {
    if (value === 0.0) {
        return new Uint8Array(0);
    }
    else if (Number.isNaN(value)) {
        return new Uint8Array([values_1.ASN1SpecialRealValue.notANumber]);
    }
    else if (value === -0.0) {
        return new Uint8Array([values_1.ASN1SpecialRealValue.minusZero]);
    }
    else if (value === Infinity) {
        return new Uint8Array([values_1.ASN1SpecialRealValue.plusInfinity]);
    }
    else if (value === -Infinity) {
        return new Uint8Array([values_1.ASN1SpecialRealValue.minusInfinity]);
    }
    const valueString = (String.fromCharCode(0b00000011) + value.toFixed(7));
    return (0, convertTextToBytes_1.default)(valueString);
}
