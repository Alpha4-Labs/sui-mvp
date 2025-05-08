"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = getBitFromBase128;
function getBitFromBase128(from, bitIndex) {
    const byteIndex = (from.length - (Math.floor(bitIndex / 7) + 1));
    return ((from[byteIndex] & (0x01 << (bitIndex % 7))) > 0);
}
