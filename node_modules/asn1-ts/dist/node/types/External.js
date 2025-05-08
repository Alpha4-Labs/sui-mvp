"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const packBits_1 = __importDefault(require("../utils/packBits"));
class External {
    constructor(directReference, indirectReference, dataValueDescriptor, encoding) {
        this.directReference = directReference;
        this.indirectReference = indirectReference;
        this.dataValueDescriptor = dataValueDescriptor;
        this.encoding = encoding;
    }
    toString() {
        let ret = "EXTERNAL { ";
        if (this.directReference) {
            ret += `directReference ${this.directReference.toString()} `;
        }
        if (this.indirectReference) {
            ret += `indirectReference ${this.indirectReference.toString()} `;
        }
        if (this.dataValueDescriptor) {
            ret += `dataValueDescriptor "${this.dataValueDescriptor}"`;
        }
        if (this.encoding instanceof Uint8Array) {
            ret += `octet-aligned ${Array.from(this.encoding).map((byte) => byte.toString(16)).join("")} `;
        }
        else if (this.encoding instanceof Uint8ClampedArray) {
            ret += `arbitrary ${this.encoding.toString()} `;
        }
        else {
            ret += `single-ASN1-type ${this.encoding.toString()} `;
        }
        ret += "}";
        return ret;
    }
    toJSON() {
        return {
            directReference: this.directReference,
            indirectReference: this.indirectReference,
            dataValueDescriptor: this.dataValueDescriptor,
            encoding: (() => {
                if (this.encoding instanceof Uint8Array) {
                    return Array.from(this.encoding).map((byte) => byte.toString(16)).join("");
                }
                else if (this.encoding instanceof Uint8ClampedArray) {
                    const bits = this.encoding;
                    return {
                        length: bits.length,
                        value: Array.from((0, packBits_1.default)(bits)).map((byte) => byte.toString(16)).join(""),
                    };
                }
                else {
                    return this.encoding.toJSON();
                }
            })(),
        };
    }
}
exports.default = External;
