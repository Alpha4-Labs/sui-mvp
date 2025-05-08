"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = convertBytesToText;
const errors_1 = require("../errors");
const node_buffer_1 = require("node:buffer");
function convertBytesToText(bytes, codec = "utf-8") {
    if (typeof node_buffer_1.Buffer !== "undefined") {
        if (bytes instanceof node_buffer_1.Buffer) {
            return bytes.toString(codec);
        }
        return (node_buffer_1.Buffer.from(bytes.buffer, bytes.byteOffset, bytes.length)).toString(codec);
    }
    else if (typeof TextEncoder !== "undefined") {
        return (new TextDecoder(codec)).decode(bytes);
    }
    throw new errors_1.ASN1Error("Neither TextDecoder nor Buffer are defined to decode bytes into text.");
}
