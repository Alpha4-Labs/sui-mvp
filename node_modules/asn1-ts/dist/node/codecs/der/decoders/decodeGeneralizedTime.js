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
exports.default = decodeGeneralizedTime;
const convertBytesToText_1 = __importDefault(require("../../../utils/convertBytesToText"));
const errors = __importStar(require("../../../errors"));
const validateDateTime_1 = __importDefault(require("../../../validators/validateDateTime"));
function decodeGeneralizedTime(value) {
    const dateString = (0, convertBytesToText_1.default)(value);
    if (!dateString.endsWith("Z")) {
        throw new errors.ASN1Error("Malformed DER GeneralizedTime string: must use UTC timezone");
    }
    const year = Number(dateString.slice(0, 4));
    const month = (Number(dateString.slice(4, 6)) - 1);
    const date = Number(dateString.slice(6, 8));
    const hours = Number(dateString.slice(8, 10));
    const minutes = Number(dateString.slice(10, 12));
    const seconds = Number(dateString.slice(12, 14));
    if (dateString[14] === '.') {
        let i = 15;
        while (value[i] && value[i] >= 0x30 && value[i] <= 0x39)
            i++;
        if (i === 15) {
            throw new errors.ASN1Error("Malformed DER GeneralizedTime string: trailing stop character");
        }
        if (dateString[i] === 'Z') {
            i++;
        }
        if (dateString[i] !== undefined) {
            throw new errors.ASN1Error("Malformed DER GeneralizedTime string: trailing data");
        }
        const fractionString = `0.${dateString.slice(15, i)}`;
        if (fractionString.endsWith("0")) {
            throw new errors.ASN1Error("Malformed DER GeneralizedTime string: trailing 0 in milliseconds");
        }
        const fraction = Number.parseFloat(fractionString);
        const milliseconds = Math.floor(1000 * fraction);
        (0, validateDateTime_1.default)("GeneralizedTime", year, month, date, hours, minutes, seconds);
        return new Date(Date.UTC(year, month, date, hours, minutes, seconds, milliseconds));
    }
    else if (dateString[14] !== 'Z') {
        throw new errors.ASN1Error("Malformed DER GeneralizedTime string: trailing data");
    }
    (0, validateDateTime_1.default)("GeneralizedTime", year, month, date, hours, minutes, seconds);
    return new Date(Date.UTC(year, month, date, hours, minutes, seconds));
}
