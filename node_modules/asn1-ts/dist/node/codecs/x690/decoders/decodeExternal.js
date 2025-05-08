"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = decodeExternal;
const External_1 = __importDefault(require("../../../types/External"));
const values_1 = require("../../../values");
const errors = __importStar(require("../../../errors"));
const decodeSequence_1 = __importDefault(require("../../der/decoders/decodeSequence"));
function decodeExternal(value) {
    const components = (0, decodeSequence_1.default)(value);
    let i = 0;
    const directReference = ((components[i]?.tagNumber === values_1.ASN1UniversalType.objectIdentifier)
        && (components[i].tagClass === values_1.ASN1TagClass.universal))
        ? components[i++].objectIdentifier
        : undefined;
    const indirectReference = ((components[i]?.tagNumber === values_1.ASN1UniversalType.integer)
        && (components[i].tagClass === values_1.ASN1TagClass.universal))
        ? components[i++].integer
        : undefined;
    const dataValueDescriptor = ((components[i]?.tagNumber === values_1.ASN1UniversalType.objectDescriptor)
        && (components[i].tagClass === values_1.ASN1TagClass.universal))
        ? components[i++].objectDescriptor
        : undefined;
    if (!directReference && !indirectReference) {
        throw new errors.ASN1ConstructionError("EXTERNAL must have direct or indirect reference.");
    }
    const encodingElement = components[i];
    if (!encodingElement || encodingElement.tagClass !== values_1.ASN1TagClass.context) {
        throw new errors.ASN1ConstructionError("EXTERNAL missing 'encoding' component.");
    }
    const encoding = (() => {
        switch (encodingElement.tagNumber) {
            case (0): return encodingElement.inner;
            case (1): return encodingElement.octetString;
            case (2): return encodingElement.bitString;
            default: {
                throw new errors.ASN1UndefinedError("EXTERNAL does not know of an encoding option "
                    + `having tag number ${encodingElement.tagNumber}.`);
            }
        }
    })();
    return new External_1.default(directReference, indirectReference, dataValueDescriptor, encoding);
}
