"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = encodeBoolean;
function encodeBoolean(value) {
    return new Uint8Array([(value ? 0xFF : 0x00)]);
}
