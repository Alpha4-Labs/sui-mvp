"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = packBits;
const macros_1 = require("../macros");
function packBits(bits) {
    const bytesNeeded = Math.ceil(bits.length / 8);
    const ret = new Uint8Array(bytesNeeded);
    let byte = -1;
    for (let bit = 0; bit < bits.length; bit++) {
        const bitMod8 = bit % 8;
        if (bitMod8 === 0) {
            byte++;
        }
        if (bits[bit] !== macros_1.FALSE_BIT) {
            ret[byte] |= (0x01 << (7 - bitMod8));
        }
    }
    return ret;
}
