"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const datetimeComponentValidator_1 = __importDefault(require("../../validators/datetimeComponentValidator"));
class TIME_OF_DAY_ENCODING {
    constructor(hours, minutes, seconds) {
        this.hours = hours;
        this.minutes = minutes;
        this.seconds = seconds;
        (0, datetimeComponentValidator_1.default)("hour", 0, 24)("TIME-OF-DAY-ENCODING", hours);
        (0, datetimeComponentValidator_1.default)("minute", 0, 59)("TIME-OF-DAY-ENCODING", minutes);
        (0, datetimeComponentValidator_1.default)("seconds", 0, 60)("TIME-OF-DAY-ENCODING", seconds);
    }
}
exports.default = TIME_OF_DAY_ENCODING;
