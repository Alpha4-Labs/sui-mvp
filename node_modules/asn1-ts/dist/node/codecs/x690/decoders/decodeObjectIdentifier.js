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
exports.default = decodeObjectIdentifier;
const ObjectIdentifier_1 = __importDefault(require("../../../types/ObjectIdentifier"));
const errors = __importStar(require("../../../errors"));
function decodeObjectIdentifier(value) {
    if (value.length === 0) {
        throw new errors.ASN1TruncationError("Encoded value was too short to be an OBJECT IDENTIFIER!");
    }
    const nodes = [0, 0];
    if (value[0] >= 0x50) {
        nodes[0] = 2;
        nodes[1] = (value[0] - 0x50);
    }
    else if (value[0] >= 0x28) {
        nodes[0] = 1;
        nodes[1] = (value[0] - 0x28);
    }
    else {
        nodes[0] = 0;
        nodes[1] = value[0];
    }
    if (value.length === 1) {
        return new ObjectIdentifier_1.default(nodes);
    }
    if (value[value.length - 1] & 0b10000000) {
        throw new errors.ASN1TruncationError("OID was truncated.");
    }
    let current_node = 0;
    for (let i = 1; i < value.length; i++) {
        const byte = value[i];
        if (current_node === 0) {
            if (byte < 128) {
                nodes.push(byte);
                continue;
            }
            if (byte === 0x80) {
                throw new errors.ASN1PaddingError("Prohibited padding on OBJECT IDENTIFIER node.");
            }
        }
        current_node <<= 7;
        current_node += (byte & 127);
        if ((byte & 128) === 0) {
            nodes.push(current_node);
            current_node = 0;
        }
    }
    return new ObjectIdentifier_1.default(nodes);
}
