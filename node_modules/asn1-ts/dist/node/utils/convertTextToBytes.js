"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = convertTextToBytes;
const errors_1 = require("../errors");
const node_buffer_1 = require("node:buffer");
function convertTextToBytes(text, codec = "utf-8") {
    if (typeof TextEncoder !== "undefined") {
        return (new TextEncoder()).encode(text);
    }
    else if (typeof node_buffer_1.Buffer !== "undefined") {
        return node_buffer_1.Buffer.from(text, codec);
    }
    throw new errors_1.ASN1Error("Neither TextEncoder nor Buffer are defined to encode text into bytes.");
}
