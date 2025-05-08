"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const datetimeComponentValidator_1 = __importDefault(require("../../validators/datetimeComponentValidator"));
class DATE_ENCODING {
    constructor(year, month, day) {
        this.year = year;
        this.month = month;
        this.day = day;
        (0, datetimeComponentValidator_1.default)("month", 1, 12)("DATE-ENCODING", month);
        (0, datetimeComponentValidator_1.default)("day", 1, 31)("DATE-ENCODING", day);
    }
}
exports.default = DATE_ENCODING;
