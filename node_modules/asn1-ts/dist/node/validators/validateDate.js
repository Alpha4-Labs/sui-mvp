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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = validateDate;
const errors = __importStar(require("../errors"));
function validateDate(dataType, year, month, date) {
    if (!Number.isSafeInteger(year)) {
        throw new errors.ASN1Error(`Invalid year in ${dataType}`);
    }
    if (!Number.isSafeInteger(month)) {
        throw new errors.ASN1Error(`Invalid month in ${dataType}`);
    }
    if (!Number.isSafeInteger(date) || (date < 1)) {
        throw new errors.ASN1Error(`Invalid day in ${dataType}`);
    }
    switch (month) {
        case 0:
        case 2:
        case 4:
        case 6:
        case 7:
        case 9:
        case 11: {
            if (date > 31) {
                throw new errors.ASN1Error(`Day > 31 encountered in ${dataType} with 31-day month.`);
            }
            break;
        }
        case 3:
        case 5:
        case 8:
        case 10: {
            if (date > 30) {
                throw new errors.ASN1Error(`Day > 31 encountered in ${dataType} with 30-day month.`);
            }
            break;
        }
        case 1: {
            const isLeapYear = ((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0);
            if (isLeapYear) {
                if (date > 29) {
                    throw new errors.ASN1Error(`Day > 29 encountered in ${dataType} with month of February in leap year.`);
                }
            }
            else if (date > 28) {
                throw new errors.ASN1Error(`Day > 28 encountered in ${dataType} with month of February and non leap year.`);
            }
            break;
        }
        default:
            throw new errors.ASN1Error(`Invalid month in ${dataType}`);
    }
}
