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
exports.default = validateTime;
const errors = __importStar(require("../errors"));
function validateTime(dataType, hours, minutes, seconds) {
    if (!Number.isSafeInteger(hours)) {
        throw new errors.ASN1Error(`Invalid hours in ${dataType}`);
    }
    if (!Number.isSafeInteger(minutes)) {
        throw new errors.ASN1Error(`Invalid minutes in ${dataType}`);
    }
    if (!Number.isSafeInteger(seconds) || (seconds < 0)) {
        throw new errors.ASN1Error(`Invalid seconds in ${dataType}`);
    }
    if (hours > 23) {
        throw new errors.ASN1Error(`Hours > 23 encountered in ${dataType}.`);
    }
    if (minutes > 59) {
        throw new errors.ASN1Error(`Minutes > 60 encountered in ${dataType}.`);
    }
    if (seconds > 59) {
        throw new errors.ASN1Error(`Seconds > 60 encountered in ${dataType}.`);
    }
}
