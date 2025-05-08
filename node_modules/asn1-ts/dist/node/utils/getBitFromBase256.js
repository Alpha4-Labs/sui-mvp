"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = getBit;
function getBit(from, bitIndex) {
    return ((from[from.length - (Math.floor(bitIndex / 8) + 1)] & (0x01 << (bitIndex % 8))) > 0);
}
