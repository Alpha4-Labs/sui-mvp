"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = isVisibleCharacter;
const isGraphicCharacter_1 = __importDefault(require("./isGraphicCharacter"));
function isVisibleCharacter(characterCode) {
    return (0, isGraphicCharacter_1.default)(characterCode);
}
