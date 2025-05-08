"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = encodeGraphicString;
const isGraphicCharacter_1 = __importDefault(require("../../../validators/isGraphicCharacter"));
const convertTextToBytes_1 = __importDefault(require("../../../utils/convertTextToBytes"));
const errors_1 = require("../../../errors");
function encodeGraphicString(value) {
    const bytes = (0, convertTextToBytes_1.default)(value);
    for (const char of bytes) {
        if (!(0, isGraphicCharacter_1.default)(char)) {
            throw new errors_1.ASN1CharactersError("GraphicString can only contain characters between 0x20 and 0x7E. "
                + `Encountered character code ${char}.`);
        }
    }
    return bytes;
}
