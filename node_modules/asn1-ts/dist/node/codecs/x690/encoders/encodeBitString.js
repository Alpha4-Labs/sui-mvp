"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = encodeBitString;
const packBits_1 = __importDefault(require("../../../utils/packBits"));
function encodeBitString(value) {
    if (value.length === 0) {
        return new Uint8Array([0]);
    }
    const ret = new Uint8Array(((value.length >>> 3) + ((value.length % 8) ? 1 : 0)) + 1);
    ret[0] = (8 - (value.length % 8));
    if (ret[0] === 8) {
        ret[0] = 0;
    }
    ret.set((0, packBits_1.default)(value), 1);
    return ret;
}
