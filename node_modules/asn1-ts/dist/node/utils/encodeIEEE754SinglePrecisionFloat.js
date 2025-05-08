"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = encodeIEEE754SinglePrecisionFloat;
function encodeIEEE754SinglePrecisionFloat(value) {
    return new Uint8Array(new Float32Array([value]).buffer).reverse();
}
