"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = encodeRelativeObjectIdentifier;
const node_buffer_1 = require("node:buffer");
function encodeRelativeObjectIdentifier(value) {
    const ret = [];
    for (const arc of value) {
        if (arc < 128) {
            ret.push(arc);
            continue;
        }
        let l = 0;
        let i = arc;
        while (i > 0) {
            l++;
            i >>>= 7;
        }
        for (let j = l - 1; j >= 0; j--) {
            let o = (arc >>> (j * 7));
            o &= 0x7f;
            if (j !== 0) {
                o |= 0x80;
            }
            ret.push(o);
        }
    }
    return node_buffer_1.Buffer.from(ret);
}
