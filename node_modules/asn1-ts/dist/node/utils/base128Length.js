"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = base128Length;
function base128Length(numberOfBytes) {
    return Math.ceil(numberOfBytes * (8 / 7));
}
