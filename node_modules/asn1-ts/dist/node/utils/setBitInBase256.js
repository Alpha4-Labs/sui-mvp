"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = setBitInBase256;
function setBitInBase256(to, bitIndex, value) {
    const byteIndex = (to.length - (Math.floor(bitIndex / 8) + 1));
    if (value) {
        to[byteIndex] |= (0x01 << (bitIndex % 8));
    }
    else {
        to[byteIndex] &= ~(0x01 << (bitIndex % 8));
    }
}
