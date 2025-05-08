"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = validateDateTime;
const validateDate_1 = __importDefault(require("./validateDate"));
const validateTime_1 = __importDefault(require("./validateTime"));
function validateDateTime(dataType, year, month, date, hours, minutes, seconds) {
    (0, validateDate_1.default)(dataType, year, month, date);
    (0, validateTime_1.default)(dataType, hours, minutes, seconds);
}
