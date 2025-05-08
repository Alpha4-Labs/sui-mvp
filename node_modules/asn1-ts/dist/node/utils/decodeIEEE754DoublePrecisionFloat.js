"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = decodeIEEE754DoublePrecisionFloat;
function decodeIEEE754DoublePrecisionFloat(bytes) {
    return new Float64Array(bytes.reverse().buffer)[0];
}
