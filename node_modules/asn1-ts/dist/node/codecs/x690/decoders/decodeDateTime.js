"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = decodeDateTime;
const convertBytesToText_1 = __importDefault(require("../../../utils/convertBytesToText"));
const validateDateTime_1 = __importDefault(require("../../../validators/validateDateTime"));
function decodeDateTime(bytes) {
    const str = (0, convertBytesToText_1.default)(bytes);
    const year = parseInt(str.slice(0, 4), 10);
    const month = parseInt(str.slice(4, 6), 10) - 1;
    const day = parseInt(str.slice(6, 8), 10);
    const hours = parseInt(str.slice(8, 10), 10);
    const minutes = parseInt(str.slice(10, 12), 10);
    const seconds = parseInt(str.slice(12, 14), 10);
    (0, validateDateTime_1.default)("DATE-TIME", year, month, day, hours, minutes, seconds);
    return new Date(year, month, day, hours, minutes, seconds);
}
