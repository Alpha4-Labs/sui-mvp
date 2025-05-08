"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = unpackBits;
const macros_1 = require("../macros");
function unpackBits(bytes) {
    const ret = new Uint8ClampedArray(bytes.length << 3);
    for (let byte = 0; byte < bytes.length; byte++) {
        for (let bit = 0; bit < 8; bit++) {
            if (bytes[byte] & (0x01 << (7 - bit))) {
                ret[(byte << 3) + bit] = macros_1.TRUE_BIT;
            }
        }
    }
    return ret;
}
