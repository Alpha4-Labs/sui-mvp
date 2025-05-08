"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = isUniquelyTagged;
function isUniquelyTagged(elements) {
    const finds = new Set([]);
    for (let i = 0; i < elements.length; i++) {
        const key = ((elements[i].tagClass << 30)
            + elements[i].tagNumber);
        if (finds.has(key)) {
            return false;
        }
        finds.add(key);
    }
    return true;
}
