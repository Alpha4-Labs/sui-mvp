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
exports.default = decodeX690RealNumber;
const errors = __importStar(require("../errors"));
const values_1 = require("../values");
const convertBytesToText_1 = __importDefault(require("./convertBytesToText"));
const decodeSignedBigEndianInteger_1 = __importDefault(require("../utils/decodeSignedBigEndianInteger"));
const decodeUnsignedBigEndianInteger_1 = __importDefault(require("../utils/decodeUnsignedBigEndianInteger"));
function decodeX690RealNumber(bytes) {
    if (bytes.length === 0)
        return 0.0;
    switch (bytes[0] & 0b11000000) {
        case (0b01000000): {
            if (bytes[0] === values_1.ASN1SpecialRealValue.notANumber)
                return NaN;
            if (bytes[0] === values_1.ASN1SpecialRealValue.minusZero)
                return -0.0;
            if (bytes[0] === values_1.ASN1SpecialRealValue.plusInfinity)
                return Infinity;
            if (bytes[0] === values_1.ASN1SpecialRealValue.minusInfinity)
                return -Infinity;
            throw new errors.ASN1UndefinedError("Unrecognized special REAL value!");
        }
        case (0b00000000): {
            const realString = (0, convertBytesToText_1.default)(bytes.subarray(1));
            switch (bytes[0] & 0b00111111) {
                case 1: {
                    if (!values_1.nr1Regex.test(realString))
                        throw new errors.ASN1Error("Malformed NR1 Base-10 REAL");
                    return Number.parseFloat(realString);
                }
                case 2: {
                    if (!values_1.nr2Regex.test(realString))
                        throw new errors.ASN1Error("Malformed NR2 Base-10 REAL");
                    return Number.parseFloat(realString.replace(",", "."));
                }
                case 3: {
                    if (!values_1.nr3Regex.test(realString))
                        throw new errors.ASN1Error("Malformed NR3 Base-10 REAL");
                    return Number.parseFloat(realString.replace(",", "."));
                }
                default:
                    throw new errors.ASN1UndefinedError("Undefined Base-10 REAL encoding.");
            }
        }
        case (0b10000000):
        case (0b11000000): {
            const sign = ((bytes[0] & 0b01000000) ? -1 : 1);
            const base = ((flag) => {
                switch (flag) {
                    case (values_1.ASN1RealEncodingBase.base2): return 2;
                    case (values_1.ASN1RealEncodingBase.base8): return 8;
                    case (values_1.ASN1RealEncodingBase.base16): return 16;
                    default:
                        throw new errors.ASN1Error("Impossible REAL encoding base encountered.");
                }
            })(bytes[0] & 0b00110000);
            const scale = ((flag) => {
                switch (flag) {
                    case (values_1.ASN1RealEncodingScale.scale0): return 0;
                    case (values_1.ASN1RealEncodingScale.scale1): return 1;
                    case (values_1.ASN1RealEncodingScale.scale2): return 2;
                    case (values_1.ASN1RealEncodingScale.scale3): return 3;
                    default:
                        throw new errors.ASN1Error("Impossible REAL encoding scale encountered.");
                }
            })(bytes[0] & 0b00001100);
            let exponent;
            let mantissa;
            switch (bytes[0] & 0b00000011) {
                case (0b00000000): {
                    if (bytes.length < 3)
                        throw new errors.ASN1TruncationError("Binary-encoded REAL truncated.");
                    exponent = (0, decodeSignedBigEndianInteger_1.default)(bytes.subarray(1, 2));
                    mantissa = (0, decodeUnsignedBigEndianInteger_1.default)(bytes.subarray(2));
                    break;
                }
                case (0b00000001): {
                    if (bytes.length < 4)
                        throw new errors.ASN1TruncationError("Binary-encoded REAL truncated.");
                    exponent = (0, decodeSignedBigEndianInteger_1.default)(bytes.subarray(1, 3));
                    mantissa = (0, decodeUnsignedBigEndianInteger_1.default)(bytes.subarray(3));
                    break;
                }
                case (0b00000010): {
                    if (bytes.length < 5)
                        throw new errors.ASN1TruncationError("Binary-encoded REAL truncated.");
                    exponent = (0, decodeSignedBigEndianInteger_1.default)(bytes.subarray(1, 4));
                    mantissa = (0, decodeUnsignedBigEndianInteger_1.default)(bytes.subarray(4));
                    break;
                }
                case (0b00000011): {
                    if (bytes.length < 3)
                        throw new errors.ASN1TruncationError("Binary-encoded REAL truncated.");
                    const exponentLength = bytes[1];
                    if (bytes.length < (3 + exponentLength)) {
                        throw new errors.ASN1TruncationError("Binary-encoded REAL truncated.");
                    }
                    exponent = (0, decodeSignedBigEndianInteger_1.default)(bytes.subarray(2, (2 + exponentLength)));
                    mantissa = (0, decodeUnsignedBigEndianInteger_1.default)(bytes.subarray((2 + exponentLength)));
                    break;
                }
                default:
                    throw new errors.ASN1Error("Impossible binary REAL exponent encoding encountered.");
            }
            return (sign * mantissa * Math.pow(2, scale) * Math.pow(base, exponent));
        }
        default:
            throw new errors.ASN1Error("Impossible REAL format encountered.");
    }
}
