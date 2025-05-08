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
exports.default = decodeDuration;
const convertBytesToText_1 = __importDefault(require("../../../utils/convertBytesToText"));
const errors = __importStar(require("../../../errors"));
const types_1 = require("../../../types");
const values_1 = require("../../../values");
function decodeDuration(bytes) {
    const str = (0, convertBytesToText_1.default)(bytes);
    if (str.indexOf(",") !== -1) {
        throw new errors.ASN1Error("Comma prohibited in DURATION when using the Distinguished or Canonical Encoding Rules.");
    }
    if (str.indexOf("W") === (str.length - 1)) {
        const weekString = str.slice(0, -1);
        const indexOfDecimalSeparator = weekString.indexOf(".");
        const weeks = indexOfDecimalSeparator !== -1
            ? parseInt(weekString.slice(0, indexOfDecimalSeparator), 10)
            : parseInt(weekString, 10);
        if (Number.isNaN(weeks)) {
            throw new errors.ASN1Error(`Could not decode a real number of weeks from DURATION ${str}.`);
        }
        let fractional_part = undefined;
        if (indexOfDecimalSeparator !== -1) {
            const fractionString = weekString.slice(indexOfDecimalSeparator + 1);
            const fractionValue = parseInt(fractionString, 10);
            if (Number.isNaN(fractionValue)) {
                throw new errors.ASN1Error(`Could not decode a fractional number of weeks from DURATION ${str}.`);
            }
            fractional_part = {
                number_of_digits: fractionString.length,
                fractional_value: fractionValue,
            };
        }
        return new types_1.DURATION_EQUIVALENT(undefined, undefined, weeks, undefined, undefined, undefined, undefined, fractional_part);
    }
    const match = values_1.datetimeRegex.exec(str);
    if (!match) {
        throw new errors.ASN1Error(`Malformed DURATION ${str}.`);
    }
    let fractional_part = undefined;
    [
        match[1],
        match[2],
        match[3],
        match[4],
        match[5],
        match[6],
    ].forEach((component) => {
        if (!component) {
            return;
        }
        if (fractional_part) {
            throw new errors.ASN1Error(`No smaller components permitted after fractional component in DURATION ${str}.`);
        }
        const indexOfFractionalSeparator = component.indexOf(".");
        if (indexOfFractionalSeparator !== -1) {
            fractional_part = {
                number_of_digits: (component.length - 1 - indexOfFractionalSeparator),
                fractional_value: Number.parseInt(component.slice(indexOfFractionalSeparator + 1), 10),
            };
        }
    });
    const years = match[1] ? Number.parseInt(match[1], 10) : undefined;
    const months = match[2] ? Number.parseInt(match[2], 10) : undefined;
    const days = match[3] ? Number.parseInt(match[3], 10) : undefined;
    const hours = match[4] ? Number.parseInt(match[4], 10) : undefined;
    const minutes = match[5] ? Number.parseInt(match[5], 10) : undefined;
    const seconds = match[6] ? Number.parseInt(match[6], 10) : undefined;
    return new types_1.DURATION_EQUIVALENT(years, months, undefined, days, hours, minutes, seconds, fractional_part);
}
