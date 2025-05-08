"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = decodePrintableString;
const isPrintableCharacter_1 = __importDefault(require("../../../validators/isPrintableCharacter"));
const convertBytesToText_1 = __importDefault(require("../../../utils/convertBytesToText"));
const errors_1 = require("../../../errors");
const values_1 = require("../../../values");
function decodePrintableString(value) {
    for (const char of value) {
        if (!(0, isPrintableCharacter_1.default)(char)) {
            throw new errors_1.ASN1CharactersError(`PrintableString can only contain these characters: ${values_1.printableStringCharacters}. `
                + `Encountered character code ${char}.`);
        }
    }
    return (0, convertBytesToText_1.default)(value);
}
