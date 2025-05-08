"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const datetimeComponentValidator_1 = __importDefault(require("../../validators/datetimeComponentValidator"));
class HOURS_MINUTES_DIFF_ENCODING {
    constructor(hours, minutes, minutes_diff) {
        this.hours = hours;
        this.minutes = minutes;
        this.minutes_diff = minutes_diff;
        (0, datetimeComponentValidator_1.default)("hour", 0, 24)("HOURS-MINUTES-DIFF-ENCODING", hours);
        (0, datetimeComponentValidator_1.default)("minute", 0, 59)("HOURS-MINUTES-DIFF-ENCODING", minutes);
        (0, datetimeComponentValidator_1.default)("minute-diff", -900, 900)("HOURS-MINUTES-DIFF-ENCODING", minutes_diff);
    }
}
exports.default = HOURS_MINUTES_DIFF_ENCODING;
