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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = validateConstruction;
const errors = __importStar(require("../errors"));
function validateConstruction(elements, specification) {
    let i = 0;
    for (const spec of specification) {
        if ((i >= elements.length)
            || (spec.tagClass && spec.tagClass !== elements[i].tagClass)
            || (spec.construction && spec.construction !== elements[i].construction)
            || (spec.tagNumber && spec.tagNumber !== elements[i].tagNumber)) {
            if (!spec.optional) {
                throw new errors.ASN1ConstructionError(`Missing required element '${spec.name}'.`);
            }
            continue;
        }
        if (spec.choice && spec.choice.length > 0) {
            let matchingChoiceFound = false;
            for (let j = 0; j < spec.choice.length; j++) {
                const choice = spec.choice[j];
                if ((!(choice.tagClass) || (choice.tagClass === elements[i].tagClass))
                    && (!(choice.construction) || (choice.construction === elements[i].construction))
                    && (!(choice.tagNumber) || (choice.tagNumber === elements[i].tagNumber))) {
                    if (choice.callback) {
                        choice.callback(elements[i]);
                    }
                    matchingChoiceFound = true;
                    break;
                }
            }
            if (!matchingChoiceFound && !spec.optional) {
                throw new errors.ASN1ConstructionError(`Missing required CHOICE '${spec.name}'.`);
            }
        }
        if (spec.callback) {
            spec.callback(elements[i]);
        }
        i++;
    }
}
