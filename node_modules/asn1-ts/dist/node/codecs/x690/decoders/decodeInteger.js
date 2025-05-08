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
exports.default = decodeInteger;
const errors = __importStar(require("../../../errors"));
const bigint_1 = require("../../../utils/bigint");
const node_buffer_1 = require("node:buffer");
function decodeInteger(value) {
    if (value.length === 0) {
        throw new errors.ASN1SizeError("INTEGER or ENUMERATED encoded on zero bytes");
    }
    if (value.length > 2
        && ((value[0] === 0xFF && value[1] >= 0b10000000)
            || (value[0] === 0x00 && value[1] < 0b10000000))) {
        const buf = node_buffer_1.Buffer.from(value.slice(0, 16));
        throw new errors.ASN1PaddingError("Unnecessary padding bytes on INTEGER or ENUMERATED. "
            + `First 16 bytes of the offending value were: 0x${buf.toString("hex")}`);
    }
    return (0, bigint_1.bufferToInteger)(value);
}
