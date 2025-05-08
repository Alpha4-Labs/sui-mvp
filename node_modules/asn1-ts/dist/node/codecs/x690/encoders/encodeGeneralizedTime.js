"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = encodeGeneralizedTime;
const convertTextToBytes_1 = __importDefault(require("../../../utils/convertTextToBytes"));
function encodeGeneralizedTime(value) {
    const year = value.getUTCFullYear().toString();
    const month = (value.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = value.getUTCDate().toString().padStart(2, "0");
    const hour = value.getUTCHours().toString().padStart(2, "0");
    const minute = value.getUTCMinutes().toString().padStart(2, "0");
    const second = value.getUTCSeconds().toString().padStart(2, "0");
    const timeString = `${year}${month}${day}${hour}${minute}${second}Z`;
    return (0, convertTextToBytes_1.default)(timeString);
}
