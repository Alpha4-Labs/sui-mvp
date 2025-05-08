"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = encodeIEEE754DoublePrecisionFloat;
function encodeIEEE754DoublePrecisionFloat(value) {
    return new Uint8Array(new Float64Array([value]).buffer).reverse();
}
