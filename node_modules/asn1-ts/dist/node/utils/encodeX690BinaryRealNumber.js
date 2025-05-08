"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = encodeX690BinaryRealNumber;
const dissectFloat_1 = __importDefault(require("./dissectFloat"));
const encodeUnsignedBigEndianInteger_1 = __importDefault(require("./encodeUnsignedBigEndianInteger"));
const encodeSignedBigEndianInteger_1 = __importDefault(require("./encodeSignedBigEndianInteger"));
const values_1 = require("../values");
const errors = __importStar(require("../errors"));
function encodeX690BinaryRealNumber(value) {
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
    const floatComponents = (0, dissectFloat_1.default)(value);
    while (floatComponents.mantissa !== 0 && (floatComponents.mantissa % 2) === 0) {
        floatComponents.mantissa = floatComponents.mantissa >>> 1;
        floatComponents.exponent++;
    }
    if (floatComponents.exponent <= -1020) {
        throw new errors.ASN1OverflowError(`REAL number ${value} (having exponent ${floatComponents.exponent}) `
            + "is too precise to encode.");
    }
    const singleByteExponent = ((floatComponents.exponent <= 127)
        && (floatComponents.exponent >= -128));
    const firstByte = (128
        | (value >= 0 ? 0 : 64)
        | (singleByteExponent ? 0 : 1));
    const exponentBytes = (0, encodeSignedBigEndianInteger_1.default)(floatComponents.exponent);
    const mantissaBytes = (0, encodeUnsignedBigEndianInteger_1.default)(floatComponents.mantissa);
    const ret = new Uint8Array(1 + exponentBytes.length + mantissaBytes.length);
    ret[0] = firstByte;
    ret.set(exponentBytes, 1);
    ret.set(mantissaBytes, (1 + exponentBytes.length));
    return ret;
}
