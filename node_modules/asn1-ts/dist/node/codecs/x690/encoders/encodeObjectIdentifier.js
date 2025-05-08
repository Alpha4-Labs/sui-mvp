"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = encodeObjectIdentifier;
const node_buffer_1 = require("node:buffer");
function encodeObjectIdentifier(value) {
    const arcs = value.uint32ArrayRef;
    const node0 = arcs[0];
    const node1 = arcs[1];
    const byte0 = (node0 * 40) + node1;
    const ret = [byte0];
    for (const arc of arcs.slice(2)) {
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
