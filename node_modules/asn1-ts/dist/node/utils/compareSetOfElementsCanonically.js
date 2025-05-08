"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = compareSetOfElementsCanonically;
function compareSetOfElementsCanonically(a, b) {
    const longestLength = (a.value.length > b.value.length)
        ? a.value.length
        : b.value.length;
    for (let i = 0; i < longestLength; i++) {
        const x = a.value[i] ?? 0;
        const y = b.value[i] ?? 0;
        if (x !== y) {
            return (x - y);
        }
    }
    return 0;
}
