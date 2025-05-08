"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = encodeReal;
const encodeX690BinaryRealNumber_1 = __importDefault(require("../../../utils/encodeX690BinaryRealNumber"));
function encodeReal(value) {
    return (0, encodeX690BinaryRealNumber_1.default)(value);
}
