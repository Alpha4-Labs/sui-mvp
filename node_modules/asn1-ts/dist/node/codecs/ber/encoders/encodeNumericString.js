"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = encodeNumericString;
const isNumericCharacter_1 = __importDefault(require("../../../validators/isNumericCharacter"));
const convertTextToBytes_1 = __importDefault(require("../../../utils/convertTextToBytes"));
const errors_1 = require("../../../errors");
function encodeNumericString(value) {
    const bytes = (0, convertTextToBytes_1.default)(value);
    for (const char of bytes) {
        if (!(0, isNumericCharacter_1.default)(char)) {
            throw new errors_1.ASN1CharactersError("NumericString can only contain characters 0 - 9 and space. "
                + `Encountered character code ${char}.`);
        }
    }
    return bytes;
}
