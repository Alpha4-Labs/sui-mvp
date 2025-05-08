"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = encodeInteger;
const bigint_1 = require("../../../utils/bigint");
function encodeInteger(value) {
    return (0, bigint_1.integerToBuffer)(value);
}
