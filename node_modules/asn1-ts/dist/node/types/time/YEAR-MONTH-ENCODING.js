"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const datetimeComponentValidator_1 = __importDefault(require("../../validators/datetimeComponentValidator"));
class YEAR_MONTH_ENCODING {
    constructor(year, month) {
        this.year = year;
        this.month = month;
        (0, datetimeComponentValidator_1.default)("month", 1, 12)("YEAR-MONTH-ENCODING", month);
    }
}
exports.default = YEAR_MONTH_ENCODING;
