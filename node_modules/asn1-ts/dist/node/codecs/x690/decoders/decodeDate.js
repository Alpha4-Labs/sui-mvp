"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = decodeDate;
const convertBytesToText_1 = __importDefault(require("../../../utils/convertBytesToText"));
const validateDate_1 = __importDefault(require("../../../validators/validateDate"));
function decodeDate(bytes) {
    const str = (0, convertBytesToText_1.default)(bytes);
    const year = parseInt(str.slice(0, 4), 10);
    const month = parseInt(str.slice(4, 6), 10) - 1;
    const day = parseInt(str.slice(6, 8), 10);
    (0, validateDate_1.default)("DATE", year, month, day);
    return new Date(year, month, day);
}
