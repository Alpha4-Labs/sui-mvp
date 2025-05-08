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
exports.default = decodeBitString;
const errors = __importStar(require("../../../errors"));
const macros_1 = require("../../../macros");
function decodeBitString(value) {
    if (value.length === 0) {
        throw new errors.ASN1Error("ASN.1 BIT STRING cannot be encoded on zero bytes!");
    }
    if (value.length === 1 && value[0] !== 0) {
        throw new errors.ASN1Error("ASN.1 BIT STRING encoded with deceptive first byte!");
    }
    if (value[0] > 7) {
        throw new errors.ASN1Error("First byte of an ASN.1 BIT STRING must be <= 7!");
    }
    const ret = [];
    for (let i = 1; i < value.length; i++) {
        ret.push(((value[i] & 0b10000000) ? macros_1.TRUE_BIT : macros_1.FALSE_BIT), ((value[i] & 0b01000000) ? macros_1.TRUE_BIT : macros_1.FALSE_BIT), ((value[i] & 0b00100000) ? macros_1.TRUE_BIT : macros_1.FALSE_BIT), ((value[i] & 0b00010000) ? macros_1.TRUE_BIT : macros_1.FALSE_BIT), ((value[i] & 0b00001000) ? macros_1.TRUE_BIT : macros_1.FALSE_BIT), ((value[i] & 0b00000100) ? macros_1.TRUE_BIT : macros_1.FALSE_BIT), ((value[i] & 0b00000010) ? macros_1.TRUE_BIT : macros_1.FALSE_BIT), ((value[i] & 0b00000001) ? macros_1.TRUE_BIT : macros_1.FALSE_BIT));
    }
    ret.length -= value[0];
    return new Uint8ClampedArray(ret);
}
