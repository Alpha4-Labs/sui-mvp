"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const datetimeComponentValidator_1 = __importDefault(require("../../validators/datetimeComponentValidator"));
class HOURS_MINUTES_ENCODING {
    constructor(hours, minutes) {
        this.hours = hours;
        this.minutes = minutes;
        (0, datetimeComponentValidator_1.default)("hour", 0, 24)("HOURS-MINUTES-ENCODING", hours);
        (0, datetimeComponentValidator_1.default)("minute", 0, 59)("HOURS-MINUTES-ENCODING", minutes);
    }
}
exports.default = HOURS_MINUTES_ENCODING;
