"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = decodeOIDIRI;
const convertBytesToText_1 = __importDefault(require("../../../utils/convertBytesToText"));
function decodeOIDIRI(bytes) {
    return (0, convertBytesToText_1.default)(bytes);
}
