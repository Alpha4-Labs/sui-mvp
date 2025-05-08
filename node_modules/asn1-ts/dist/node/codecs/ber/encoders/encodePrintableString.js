"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = encodeNumericString;
const isPrintableCharacter_1 = __importDefault(require("../../../validators/isPrintableCharacter"));
const convertTextToBytes_1 = __importDefault(require("../../../utils/convertTextToBytes"));
const errors_1 = require("../../../errors");
const values_1 = require("../../../values");
function encodeNumericString(value) {
    const bytes = (0, convertTextToBytes_1.default)(value);
    for (const char of bytes) {
        if (!(0, isPrintableCharacter_1.default)(char)) {
            throw new errors_1.ASN1CharactersError(`PrintableString can only contain these characters: ${values_1.printableStringCharacters}. `
                + `Encountered character code ${char}.`);
        }
    }
    return bytes;
}
