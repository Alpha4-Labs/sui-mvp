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
class DURATION_EQUIVALENT {
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
            throw new errors.ASN1Error("DURATION-EQUIVALENT may not combine week components and date-time components.");
        }
        if (years) {
            (0, datetimeComponentValidator_1.default)("year", 0, Number.MAX_SAFE_INTEGER)("DURATION-EQUIVALENT", years);
        }
        if (months) {
            (0, datetimeComponentValidator_1.default)("month", 0, Number.MAX_SAFE_INTEGER)("DURATION-EQUIVALENT", months);
        }
        if (weeks) {
            (0, datetimeComponentValidator_1.default)("week", 0, Number.MAX_SAFE_INTEGER)("DURATION-EQUIVALENT", weeks);
        }
        if (days) {
            (0, datetimeComponentValidator_1.default)("day", 0, Number.MAX_SAFE_INTEGER)("DURATION-EQUIVALENT", days);
        }
        if (hours) {
            (0, datetimeComponentValidator_1.default)("hour", 0, Number.MAX_SAFE_INTEGER)("DURATION-EQUIVALENT", hours);
        }
        if (minutes) {
            (0, datetimeComponentValidator_1.default)("minute", 0, Number.MAX_SAFE_INTEGER)("DURATION-EQUIVALENT", minutes);
        }
        if (seconds) {
            (0, datetimeComponentValidator_1.default)("second", 0, Number.MAX_SAFE_INTEGER)("DURATION-EQUIVALENT", seconds);
        }
        if (fractional_part && !Number.isSafeInteger(fractional_part.fractional_value)) {
            throw new errors.ASN1Error("Malformed DURATION-EQUIVALENT fractional part.");
        }
    }
    toString() {
        let ret = "DURATION { ";
        if (this.years !== undefined) {
            ret += `years ${this.years}`;
        }
        if (this.months !== undefined) {
            ret += `months ${this.months}`;
        }
        if (this.weeks !== undefined) {
            ret += `weeks ${this.weeks}`;
        }
        if (this.days !== undefined) {
            ret += `days ${this.days}`;
        }
        if (this.hours !== undefined) {
            ret += `hours ${this.hours}`;
        }
        if (this.minutes !== undefined) {
            ret += `minutes ${this.minutes}`;
        }
        if (this.seconds !== undefined) {
            ret += `seconds ${this.seconds}`;
        }
        ret += "}";
        return ret;
    }
    toJSON() {
        return {
            years: this.years,
            months: this.months,
            weeks: this.weeks,
            days: this.days,
            hours: this.hours,
            minutes: this.minutes,
            seconds: this.seconds,
            fractional_part: this.fractional_part
                ? {
                    number_of_digits: this.fractional_part.number_of_digits,
                    fractional_value: this.fractional_part.fractional_value,
                }
                : undefined,
        };
    }
}
exports.default = DURATION_EQUIVALENT;
