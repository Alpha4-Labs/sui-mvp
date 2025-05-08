"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = encodeSequence;
const node_buffer_1 = require("node:buffer");
function encodeSequence(value) {
    return node_buffer_1.Buffer.concat(value.map((v) => v.toBytes()));
}
