"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = decodeSequence;
const cer_1 = __importDefault(require("../../cer"));
function decodeSequence(value) {
    if (value.length === 0) {
        return [];
    }
    const encodedElements = [];
    let i = 0;
    while (i < value.length) {
        const next = new cer_1.default();
        i += next.fromBytes(value.subarray(i));
        encodedElements.push(next);
    }
    return encodedElements;
}
