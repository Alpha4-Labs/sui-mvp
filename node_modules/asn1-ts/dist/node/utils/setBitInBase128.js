"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = setBit;
function setBit(to, bitIndex, value) {
    const byteIndex = to.length - (Math.floor(bitIndex / 7) + 1);
    if (value) {
        to[byteIndex] |= (0x01 << (bitIndex % 7));
    }
    else {
        to[byteIndex] &= ~(0x01 << (bitIndex % 7));
    }
}
