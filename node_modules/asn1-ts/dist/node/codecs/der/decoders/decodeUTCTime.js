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
const DER_UTC_TIME_LENGTH = "920521000000Z".length;
function decodeUTCTime(value) {
    if (value.length !== DER_UTC_TIME_LENGTH) {
        throw new errors.ASN1Error("Malformed DER UTCTime string: not a valid length");
    }
    const dateString = (0, convertBytesToText_1.default)(value);
    if (!dateString.endsWith("Z")) {
        throw new errors.ASN1Error("Malformed DER UTCTime string: not UTC timezone");
    }
    let year = Number(dateString.slice(0, 2));
    const month = (Number(dateString.slice(2, 4)) - 1);
    const date = Number(dateString.slice(4, 6));
    const hours = Number(dateString.slice(6, 8));
    const minutes = Number(dateString.slice(8, 10));
    const seconds = Number(dateString.slice(10, 12));
    year = (year <= 49)
        ? (2000 + year)
        : (1900 + year);
    (0, validateDateTime_1.default)("UTCTime", year, month, date, hours, minutes, seconds);
    return new Date(Date.UTC(year, month, date, hours, minutes, seconds));
}
