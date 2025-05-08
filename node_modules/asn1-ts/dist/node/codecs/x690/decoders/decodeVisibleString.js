"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = decodePrintableString;
const isVisibleCharacter_1 = __importDefault(require("../../../validators/isVisibleCharacter"));
const convertBytesToText_1 = __importDefault(require("../../../utils/convertBytesToText"));
const errors_1 = require("../../../errors");
function decodePrintableString(value) {
    for (const char of value) {
        if (!(0, isVisibleCharacter_1.default)(char)) {
            throw new errors_1.ASN1CharactersError("VisibleString can only contain characters between 0x20 and 0x7E. "
                + `Encountered character code ${char}.`);
        }
    }
    return (0, convertBytesToText_1.default)(value);
}
