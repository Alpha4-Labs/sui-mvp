"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const datetimeComponentValidator_1 = __importDefault(require("../../validators/datetimeComponentValidator"));
class TIME_OF_DAY_FRACTION_DIFF_ENCODING {
    constructor(hours, minutes, seconds, fractional_part, minutes_diff) {
        this.hours = hours;
        this.minutes = minutes;
        this.seconds = seconds;
        this.fractional_part = fractional_part;
        this.minutes_diff = minutes_diff;
        (0, datetimeComponentValidator_1.default)("hour", 0, 24)("TIME-OF-DAY-FRACTION-DIFF-ENCODING", hours);
        (0, datetimeComponentValidator_1.default)("minute", 0, 59)("TIME-OF-DAY-FRACTION-DIFF-ENCODING", minutes);
        (0, datetimeComponentValidator_1.default)("seconds", 0, 60)("TIME-OF-DAY-FRACTION-DIFF-ENCODING", seconds);
        (0, datetimeComponentValidator_1.default)("fractional-part", 0, Number.MAX_SAFE_INTEGER)("TIME-OF-DAY-FRACTION-DIFF-ENCODING", fractional_part);
        (0, datetimeComponentValidator_1.default)("minute-diff", -900, 900)("TIME-OF-DAY-FRACTION-DIFF-ENCODING", minutes_diff);
    }
}
exports.default = TIME_OF_DAY_FRACTION_DIFF_ENCODING;
