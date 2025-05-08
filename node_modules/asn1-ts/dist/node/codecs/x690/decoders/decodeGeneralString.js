"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = decodeGeneralString;
const isGeneralCharacter_1 = __importDefault(require("../../../validators/isGeneralCharacter"));
const convertBytesToText_1 = __importDefault(require("../../../utils/convertBytesToText"));
const errors_1 = require("../../../errors");
function decodeGeneralString(value) {
    for (const char of value) {
        if (!(0, isGeneralCharacter_1.default)(char)) {
            throw new errors_1.ASN1CharactersError("GeneralString can only contain ASCII characters."
                + `Encountered character code ${char}.`);
        }
    }
    return (0, convertBytesToText_1.default)(value);
}
