"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = encodeRelativeOIDIRI;
const convertTextToBytes_1 = __importDefault(require("../../../utils/convertTextToBytes"));
function encodeRelativeOIDIRI(value) {
    return (0, convertTextToBytes_1.default)(value);
}
