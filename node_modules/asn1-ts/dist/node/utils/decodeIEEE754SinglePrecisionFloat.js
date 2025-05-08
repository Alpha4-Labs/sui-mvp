"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = decodeIEEE754SinglePrecisionFloat;
function decodeIEEE754SinglePrecisionFloat(bytes) {
    return new Float32Array(bytes.reverse().buffer)[0];
}
