"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = splitOctetsCanonically;
function* splitOctetsCanonically(value) {
    for (let i = 0; i < value.length; i += 1000) {
        yield value.subarray(i, i + 1000);
    }
}
