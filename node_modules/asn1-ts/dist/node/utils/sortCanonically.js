"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = sortCanonically;
const node_buffer_1 = require("node:buffer");
function sortCanonically(elements) {
    return elements.sort((a, b) => {
        const aClassOrder = a.tagClass;
        const bClassOrder = b.tagClass;
        if (aClassOrder !== bClassOrder) {
            return (aClassOrder - bClassOrder);
        }
        return node_buffer_1.Buffer.compare(a.toBytes(), b.toBytes());
    });
}
