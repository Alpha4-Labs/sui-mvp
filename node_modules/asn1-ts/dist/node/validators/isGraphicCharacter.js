"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = isGraphicCharacter;
function isGraphicCharacter(characterCode) {
    return (characterCode >= 0x20 && characterCode <= 0x7E);
}
