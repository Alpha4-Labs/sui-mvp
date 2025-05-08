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
const errors = __importStar(require("../../../errors"));
const convertBytesToText_1 = __importDefault(require("../../../utils/convertBytesToText"));
const validateDateTime_1 = __importDefault(require("../../../validators/validateDateTime"));
const SMALLEST_CORRECT_GENERALIZED_TIME = "2000120123".length;
const PERIOD = ".".charCodeAt(0);
const COMMA = ",".charCodeAt(0);
const Z = "Z".charCodeAt(0);
const PLUS = "+".charCodeAt(0);
const MINUS = "-".charCodeAt(0);
;
function isStop(s, i) {
    const char = s.charCodeAt(i);
    return (char === PERIOD) || (char === COMMA);
}
function decodeGeneralizedTime(value) {
    if (value.length < SMALLEST_CORRECT_GENERALIZED_TIME) {
        throw new errors.ASN1Error("Malformed GeneralizedTime string.");
    }
    if (value.length > 32) {
        throw new errors.ASN1Error("Outrageously large GeneralizedTime string.");
    }
    const dateString = (0, convertBytesToText_1.default)(value);
    const year = Number(dateString.slice(0, 4));
    const month = (Number(dateString.slice(4, 6)) - 1);
    const date = Number(dateString.slice(6, 8));
    const hours = Number(dateString.slice(8, 10));
    if (value.length === 10) {
        (0, validateDateTime_1.default)("GeneralizedTime", year, month, date, hours, 0, 0);
        return new Date(year, month, date, hours, 0, 0);
    }
    let i = 10;
    while (value[i] && value[i] >= 0x30 && value[i] <= 0x39)
        i++;
    let minutes = 0;
    let seconds = 0;
    let milliseconds = 0;
    let fractionUnits = 0;
    if (i == 14) {
        minutes = Number.parseInt(dateString.slice(10, 12), 10);
        seconds = Number.parseInt(dateString.slice(12, 14), 10);
        fractionUnits = 2;
    }
    else if (i == 12) {
        minutes = Number.parseInt(dateString.slice(10, 12), 10);
        fractionUnits = 1;
    }
    else if (i != 10) {
        throw new errors.ASN1Error("Malformed GeneralizedTime string.");
    }
    if (value[i] === undefined) {
        (0, validateDateTime_1.default)("GeneralizedTime", year, month, date, hours, minutes, seconds);
        return new Date(year, month, date, hours, minutes, seconds);
    }
    if (isStop(dateString, i)) {
        i++;
        let j = i;
        while (value[j] && value[j] >= 0x30 && value[j] <= 0x39)
            j++;
        const fractionString = `0.${dateString.slice(i, j)}`;
        i = j;
        const fraction = Number.parseFloat(fractionString);
        if (fractionUnits === 0) {
            minutes = Math.floor(60 * fraction);
            seconds = Math.floor((60 * 60 * fraction) % 60);
        }
        else if (fractionUnits === 1) {
            seconds = Math.floor(60 * fraction);
        }
        else if (fractionUnits === 2) {
            milliseconds = Math.floor(1000 * fraction);
        }
        else {
            throw new Error("internal asn1-ts error: invalid FractionalUnits");
        }
    }
    if (value[i] === undefined) {
        (0, validateDateTime_1.default)("GeneralizedTime", year, month, date, hours, minutes, seconds);
        return new Date(year, month, date, hours, minutes, seconds, milliseconds);
    }
    if (value[i] === Z) {
        (0, validateDateTime_1.default)("GeneralizedTime", year, month, date, hours, minutes, seconds);
        return new Date(Date.UTC(year, month, date, hours, minutes, seconds, milliseconds));
    }
    if (value[i] === PLUS || value[i] === MINUS) {
        const isPositive = value[i] === PLUS;
        i++;
        let j = i;
        while (value[j] && value[j] >= 0x30 && value[j] <= 0x39)
            j++;
        const offsetSize = j - i;
        if (value[j] !== undefined) {
            throw new errors.ASN1Error("Malformed GeneralizedTime string.");
        }
        let offsetHour = 0;
        let offsetMinute = 0;
        if (offsetSize === 4) {
            offsetHour = Number.parseInt(dateString.slice(j - 4, j - 2), 10);
            offsetMinute = Number.parseInt(dateString.slice(j - 2, j), 10);
        }
        else if (offsetSize === 2) {
            offsetHour = Number.parseInt(dateString.slice(j - 2, j));
        }
        else {
            throw new errors.ASN1Error("Malformed GeneralizedTime string.");
        }
        let epochTimeInMS = Date.UTC(year, month, date, hours, minutes, seconds, milliseconds);
        const sign = isPositive ? -1 : 1;
        epochTimeInMS += sign * ((offsetHour * 60 * 60 * 1000) + (offsetMinute * 60 * 1000));
        return new Date(epochTimeInMS);
    }
    if (value[i] !== undefined) {
        throw new errors.ASN1Error("Malformed GeneralizedTime string.");
    }
    (0, validateDateTime_1.default)("GeneralizedTime", year, month, date, hours, minutes, seconds);
    return new Date(Date.UTC(year, month, date, hours, minutes, seconds, milliseconds));
}
