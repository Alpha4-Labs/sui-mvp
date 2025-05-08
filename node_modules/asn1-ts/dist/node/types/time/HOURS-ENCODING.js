"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const datetimeComponentValidator_1 = __importDefault(require("../../validators/datetimeComponentValidator"));
class HOURS_ENCODING {
    constructor(hours) {
        this.hours = hours;
        (0, datetimeComponentValidator_1.default)("hour", 0, 24)("HOURS-ENCODING", hours);
    }
}
exports.default = HOURS_ENCODING;
