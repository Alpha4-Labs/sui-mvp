"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = isObjectDescriptorCharacter;
const isGraphicCharacter_1 = __importDefault(require("./isGraphicCharacter"));
function isObjectDescriptorCharacter(characterCode) {
    return (0, isGraphicCharacter_1.default)(characterCode);
}
