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
exports.default = decodeUTCTime;
const convertBytesToText_1 = __importDefault(require("../../../utils/convertBytesToText"));
const errors = __importStar(require("../../../errors"));
const validateDateTime_1 = __importDefault(require("../../../validators/validateDateTime"));
function decodeUTCTime(value) {
    const dateString = (0, convertBytesToText_1.default)(value);
    let year = Number(dateString.slice(0, 2));
    year = (year <= 49)
        ? (2000 + year)
        : (1900 + year);
    const month = (Number(dateString.slice(2, 4)) - 1);
    const date = Number(dateString.slice(4, 6));
    const hours = Number(dateString.slice(6, 8));
    const minutes = Number(dateString.slice(8, 10));
    const char10 = dateString.charCodeAt(10);
    const secondsFieldPresent = (char10 >= 0x30 && char10 <= 0x39);
    const seconds = secondsFieldPresent
        ? Number(dateString.slice(10, 12))
        : 0;
    let i = secondsFieldPresent ? 12 : 10;
    if (dateString[i] === 'Z') {
        (0, validateDateTime_1.default)("UTCTime", year, month, date, hours, minutes, seconds);
        return new Date(Date.UTC(year, month, date, hours, minutes, seconds));
    }
    if ((dateString[i] !== '+') && (dateString[i] !== '-')) {
        throw new errors.ASN1Error(`Malformed BER UTCTime: non +/- offset: ${dateString[i]}`);
    }
    const isPositive = dateString[i] === '+';
    i++;
    let j = 0;
    while (value[i + j] && value[i + j] >= 0x30 && value[i + j] <= 0x39)
        j++;
    if (j !== 4) {
        throw new errors.ASN1Error("Malformed BER UTCTime: non four-digit offset");
    }
    i += j;
    if (dateString[i] !== undefined) {
        throw new errors.ASN1Error("Malformed BER UTCTime: trailing data");
    }
    const offsetHour = Number.parseInt(dateString.slice(i - 4, i - 2), 10);
    const offsetMinute = Number.parseInt(dateString.slice(i - 2, i), 10);
    let epochTimeInMS = Date.UTC(year, month, date, hours, minutes, seconds);
    const sign = isPositive ? -1 : 1;
    epochTimeInMS += sign * ((offsetHour * 60 * 60 * 1000) + (offsetMinute * 60 * 1000));
    return new Date(epochTimeInMS);
}
