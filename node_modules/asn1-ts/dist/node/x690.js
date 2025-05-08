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
const asn1_1 = __importDefault(require("./asn1"));
const errors = __importStar(require("./errors"));
const values_1 = require("./values");
const encodeInteger_1 = __importDefault(require("./codecs/x690/encoders/encodeInteger"));
const decodeInteger_1 = __importDefault(require("./codecs/x690/decoders/decodeInteger"));
const encodeObjectIdentifier_1 = __importDefault(require("./codecs/x690/encoders/encodeObjectIdentifier"));
const decodeObjectIdentifier_1 = __importDefault(require("./codecs/x690/decoders/decodeObjectIdentifier"));
const encodeRelativeObjectIdentifier_1 = __importDefault(require("./codecs/x690/encoders/encodeRelativeObjectIdentifier"));
const decodeRelativeObjectIdentifier_1 = __importDefault(require("./codecs/x690/decoders/decodeRelativeObjectIdentifier"));
const encodeTime_1 = __importDefault(require("./codecs/x690/encoders/encodeTime"));
const decodeTime_1 = __importDefault(require("./codecs/x690/decoders/decodeTime"));
const encodeDate_1 = __importDefault(require("./codecs/x690/encoders/encodeDate"));
const decodeDate_1 = __importDefault(require("./codecs/x690/decoders/decodeDate"));
const encodeTimeOfDay_1 = __importDefault(require("./codecs/x690/encoders/encodeTimeOfDay"));
const decodeTimeOfDay_1 = __importDefault(require("./codecs/x690/decoders/decodeTimeOfDay"));
const encodeDateTime_1 = __importDefault(require("./codecs/x690/encoders/encodeDateTime"));
const decodeDateTime_1 = __importDefault(require("./codecs/x690/decoders/decodeDateTime"));
const encodeOIDIRI_1 = __importDefault(require("./codecs/x690/encoders/encodeOIDIRI"));
const decodeOIDIRI_1 = __importDefault(require("./codecs/x690/decoders/decodeOIDIRI"));
const encodeRelativeOIDIRI_1 = __importDefault(require("./codecs/x690/encoders/encodeRelativeOIDIRI"));
const decodeRelativeOIDIRI_1 = __importDefault(require("./codecs/x690/decoders/decodeRelativeOIDIRI"));
class X690Element extends asn1_1.default {
    set integer(value) {
        this.value = (0, encodeInteger_1.default)(value);
    }
    get integer() {
        if (this.construction !== values_1.ASN1Construction.primitive) {
            throw new errors.ASN1ConstructionError("INTEGER cannot be constructed.", this);
        }
        return (0, decodeInteger_1.default)(this.value);
    }
    set objectIdentifier(value) {
        this.value = (0, encodeObjectIdentifier_1.default)(value);
    }
    get objectIdentifier() {
        if (this.construction !== values_1.ASN1Construction.primitive) {
            throw new errors.ASN1ConstructionError("OBJECT IDENTIFIER cannot be constructed.", this);
        }
        if (this.value.length === 0) {
            throw new errors.ASN1TruncationError("Encoded value was too short to be an OBJECT IDENTIFIER!", this);
        }
        return (0, decodeObjectIdentifier_1.default)(this.value);
    }
    set enumerated(value) {
        this.integer = value;
    }
    get enumerated() {
        return Number(this.integer);
    }
    set relativeObjectIdentifier(value) {
        this.value = (0, encodeRelativeObjectIdentifier_1.default)(value);
    }
    get relativeObjectIdentifier() {
        if (this.construction !== values_1.ASN1Construction.primitive) {
            throw new errors.ASN1ConstructionError("Relative OID cannot be constructed.", this);
        }
        return (0, decodeRelativeObjectIdentifier_1.default)(this.value);
    }
    set time(value) {
        this.value = (0, encodeTime_1.default)(value);
    }
    get time() {
        return (0, decodeTime_1.default)(this.value);
    }
    set date(value) {
        this.value = (0, encodeDate_1.default)(value);
    }
    get date() {
        return (0, decodeDate_1.default)(this.value);
    }
    set timeOfDay(value) {
        this.value = (0, encodeTimeOfDay_1.default)(value);
    }
    get timeOfDay() {
        return (0, decodeTimeOfDay_1.default)(this.value);
    }
    set dateTime(value) {
        this.value = (0, encodeDateTime_1.default)(value);
    }
    get dateTime() {
        return (0, decodeDateTime_1.default)(this.value);
    }
    set oidIRI(value) {
        this.value = (0, encodeOIDIRI_1.default)(value);
    }
    get oidIRI() {
        return (0, decodeOIDIRI_1.default)(this.value);
    }
    set relativeOIDIRI(value) {
        this.value = (0, encodeRelativeOIDIRI_1.default)(value);
    }
    get relativeOIDIRI() {
        return (0, decodeRelativeOIDIRI_1.default)(this.value);
    }
}
exports.default = X690Element;
