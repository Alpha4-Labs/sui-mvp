"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = decodeTimeOfDay;
const convertBytesToText_1 = __importDefault(require("../../../utils/convertBytesToText"));
const validateTime_1 = __importDefault(require("../../../validators/validateTime"));
function decodeTimeOfDay(bytes) {
    const str = (0, convertBytesToText_1.default)(bytes);
    const hours = parseInt(str.slice(0, 2), 10);
    const minutes = parseInt(str.slice(2, 4), 10);
    const seconds = parseInt(str.slice(4, 6), 10);
    (0, validateTime_1.default)("TIME-OF-DAY", hours, minutes, seconds);
    const ret = new Date();
    ret.setHours(hours);
    ret.setMinutes(minutes);
    ret.setSeconds(seconds);
    return ret;
}
