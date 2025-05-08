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
const errors = __importStar(require("../../errors"));
const datetimeComponentValidator_1 = __importDefault(require("../../validators/datetimeComponentValidator"));
class DURATION_INTERVAL_ENCODING {
    constructor(years, months, weeks, days, hours, minutes, seconds, fractional_part) {
        this.years = years;
        this.months = months;
        this.weeks = weeks;
        this.days = days;
        this.hours = hours;
        this.minutes = minutes;
        this.seconds = seconds;
        this.fractional_part = fractional_part;
        if (typeof weeks !== "undefined"
            && (years || months || days || hours || minutes || seconds)) {
            throw new errors.ASN1Error("DURATION-INTERVAL-ENCODING may not combine week components and date-time components.");
        }
        if (years) {
            (0, datetimeComponentValidator_1.default)("year", 0, Number.MAX_SAFE_INTEGER)("DURATION-INTERVAL-ENCODING", years);
        }
        if (months) {
            (0, datetimeComponentValidator_1.default)("month", 0, Number.MAX_SAFE_INTEGER)("DURATION-INTERVAL-ENCODING", months);
        }
        if (weeks) {
            (0, datetimeComponentValidator_1.default)("week", 0, Number.MAX_SAFE_INTEGER)("DURATION-INTERVAL-ENCODING", weeks);
        }
        if (days) {
            (0, datetimeComponentValidator_1.default)("day", 0, Number.MAX_SAFE_INTEGER)("DURATION-INTERVAL-ENCODING", days);
        }
        if (hours) {
            (0, datetimeComponentValidator_1.default)("hour", 0, Number.MAX_SAFE_INTEGER)("DURATION-INTERVAL-ENCODING", hours);
        }
        if (minutes) {
            (0, datetimeComponentValidator_1.default)("minute", 0, Number.MAX_SAFE_INTEGER)("DURATION-INTERVAL-ENCODING", minutes);
        }
        if (seconds) {
            (0, datetimeComponentValidator_1.default)("second", 0, Number.MAX_SAFE_INTEGER)("DURATION-INTERVAL-ENCODING", seconds);
        }
        if (fractional_part && !Number.isSafeInteger(fractional_part.fractional_value)) {
            throw new errors.ASN1Error("Malformed DURATION-INTERVAL-ENCODING fractional part.");
        }
    }
}
exports.default = DURATION_INTERVAL_ENCODING;
