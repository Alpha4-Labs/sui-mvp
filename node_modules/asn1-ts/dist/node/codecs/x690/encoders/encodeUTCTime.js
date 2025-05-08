"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = encodeUTCTime;
const convertTextToBytes_1 = __importDefault(require("../../../utils/convertTextToBytes"));
function encodeUTCTime(value) {
    let year = value.getUTCFullYear().toString();
    year = (year.substring(year.length - 2, year.length));
    const month = (value.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = value.getUTCDate().toString().padStart(2, "0");
    const hour = value.getUTCHours().toString().padStart(2, "0");
    const minute = value.getUTCMinutes().toString().padStart(2, "0");
    const second = value.getUTCSeconds().toString().padStart(2, "0");
    const utcString = `${year}${month}${day}${hour}${minute}${second}Z`;
    return (0, convertTextToBytes_1.default)(utcString);
}
