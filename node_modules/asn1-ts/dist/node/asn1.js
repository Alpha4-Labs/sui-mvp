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
const errors = __importStar(require("./errors"));
const values_1 = require("./values");
const packBits_1 = __importDefault(require("./utils/packBits"));
const node_buffer_1 = require("node:buffer");
class ASN1Element {
    constructor() {
        this.recursionCount = 0;
        this.name = "";
        this.tagClass = values_1.ASN1TagClass.universal;
        this.construction = values_1.ASN1Construction.primitive;
        this._tagNumber = 0;
    }
    get tagNumber() {
        return this._tagNumber;
    }
    set tagNumber(value) {
        if (!Number.isSafeInteger(value) || (value < 0)) {
            throw new errors.ASN1Error(`Tag ${value} was not a non-negative integer.`);
        }
        this._tagNumber = value;
    }
    tagLength() {
        if (this.tagNumber < 31) {
            return 1;
        }
        let n = this.tagNumber;
        let i = 0;
        while (n !== 0) {
            n >>>= 7;
            i++;
        }
        return i;
    }
    toBytes() {
        return node_buffer_1.Buffer.concat(this.toBuffers());
    }
    get length() {
        return this.value.length;
    }
    validateSize(name, units, actualSize, min, max) {
        const effectiveMax = (typeof max === "undefined" ? Infinity : max);
        if (actualSize < min) {
            throw new errors.ASN1SizeError(`${name} encoded ${actualSize} ${units} when the `
                + `minimum permissible is ${min} ${units}.`);
        }
        if (actualSize > effectiveMax) {
            throw new errors.ASN1SizeError(`${name} encoded ${actualSize} ${units} when the `
                + `maximum permissible is ${effectiveMax} ${units}.`);
        }
    }
    validateRange(name, actualValue, min, max) {
        if (actualValue < min) {
            throw new errors.ASN1OverflowError(`${name} was ${actualValue} when the `
                + `minimum permissible is ${min}.`);
        }
        if (max === undefined) {
            return;
        }
        if (actualValue > max) {
            throw new errors.ASN1OverflowError(`${name} was ${actualValue} when the `
                + `maximum permissible is ${max}.`);
        }
    }
    sizeConstrainedBitString(min, max) {
        const ret = this.bitString;
        this.validateSize(this.name || "BIT STRING", "bits", ret.length, min, max);
        return ret;
    }
    sizeConstrainedOctetString(min, max) {
        const ret = this.octetString;
        this.validateSize(this.name || "OCTET STRING", "octets", ret.length, min, max);
        return ret;
    }
    sizeConstrainedObjectDescriptor(min, max) {
        const ret = this.objectDescriptor;
        this.validateSize(this.name || "ObjectDescriptor", "characters", ret.length, min, max);
        return ret;
    }
    sizeConstrainedUTF8String(min, max) {
        const ret = this.utf8String;
        this.validateSize(this.name || "UTF8String", "characters", ret.length, min, max);
        return ret;
    }
    sizeConstrainedSequenceOf(min, max) {
        const ret = this.sequenceOf;
        this.validateSize(this.name || "SEQUENCE OF", "elements", ret.length, min, max);
        return ret;
    }
    sizeConstrainedSetOf(min, max) {
        const ret = this.setOf;
        this.validateSize(this.name || "SET OF", "elements", ret.length, min, max);
        return ret;
    }
    sizeConstrainedNumericString(min, max) {
        const ret = this.numericString;
        this.validateSize(this.name || "NumericString", "characters", ret.length, min, max);
        return ret;
    }
    sizeConstrainedPrintableString(min, max) {
        const ret = this.printableString;
        this.validateSize(this.name || "PrintableString", "characters", ret.length, min, max);
        return ret;
    }
    sizeConstrainedTeletexString(min, max) {
        const ret = this.teletexString;
        this.validateSize(this.name || "TeletexString", "characters", ret.length, min, max);
        return ret;
    }
    sizeConstrainedVideotexString(min, max) {
        const ret = this.videotexString;
        this.validateSize(this.name || "VideotexString", "characters", ret.length, min, max);
        return ret;
    }
    sizeConstrainedIA5String(min, max) {
        const ret = this.ia5String;
        this.validateSize(this.name || "IA5String", "characters", ret.length, min, max);
        return ret;
    }
    sizeConstrainedGraphicString(min, max) {
        const ret = this.graphicString;
        this.validateSize(this.name || "GraphicString", "characters", ret.length, min, max);
        return ret;
    }
    sizeConstrainedVisibleString(min, max) {
        const ret = this.visibleString;
        this.validateSize(this.name || "VisibleString", "characters", ret.length, min, max);
        return ret;
    }
    sizeConstrainedGeneralString(min, max) {
        const ret = this.generalString;
        this.validateSize(this.name || "GeneralString", "characters", ret.length, min, max);
        return ret;
    }
    sizeConstrainedUniversalString(min, max) {
        const ret = this.universalString;
        this.validateSize(this.name || "UniversalString", "characters", ret.length, min, max);
        return ret;
    }
    sizeConstrainedBMPString(min, max) {
        const ret = this.bmpString;
        this.validateSize(this.name || "BMPString", "characters", ret.length, min, max);
        return ret;
    }
    rangeConstrainedInteger(min, max) {
        const ret = this.integer;
        this.validateRange(this.name || "INTEGER", ret, min, max);
        return ret;
    }
    rangeConstrainedReal(min, max) {
        const ret = this.real;
        this.validateRange(this.name || "REAL", ret, min, max);
        return ret;
    }
    validateTag(permittedClasses, permittedConstruction, permittedNumbers) {
        if (!permittedClasses.includes(this.tagClass))
            return -1;
        if (!permittedConstruction.includes(this.construction))
            return -2;
        if (!permittedNumbers.includes(this.tagNumber))
            return -3;
        return 0;
    }
    toElement() {
        return this;
    }
    fromElement(el) {
        this.tagClass = el.tagClass;
        this.construction = el.construction;
        this.tagNumber = el.tagNumber;
        this.value = new Uint8Array(el.value);
    }
    toString() {
        if (this.tagClass === values_1.ASN1TagClass.universal) {
            switch (this.tagNumber) {
                case (values_1.ASN1UniversalType.endOfContent): return "END-OF-CONTENT";
                case (values_1.ASN1UniversalType.boolean): return (this.boolean ? "TRUE" : "FALSE");
                case (values_1.ASN1UniversalType.integer): return this.integer.toString();
                case (values_1.ASN1UniversalType.bitString):
                    return `'${Array
                        .from(this.bitString)
                        .map((num) => num.toString())
                        .join("")}'B`;
                case (values_1.ASN1UniversalType.octetString):
                    return `'${Array
                        .from(this.octetString)
                        .map((byte) => byte.toString(16).padStart(2, "0"))
                        .join("")}'H`;
                case (values_1.ASN1UniversalType.nill): return "NULL";
                case (values_1.ASN1UniversalType.objectIdentifier): return this.objectIdentifier.asn1Notation;
                case (values_1.ASN1UniversalType.objectDescriptor): return `"${this.objectDescriptor}"`;
                case (values_1.ASN1UniversalType.external): return "EXTERNAL";
                case (values_1.ASN1UniversalType.realNumber): return this.real.toString();
                case (values_1.ASN1UniversalType.enumerated): return this.enumerated.toString();
                case (values_1.ASN1UniversalType.embeddedPDV): return "EMBEDDED PDV";
                case (values_1.ASN1UniversalType.utf8String): return `"${this.utf8String}"`;
                case (values_1.ASN1UniversalType.relativeOID): return "{ " + this.relativeObjectIdentifier
                    .map((arc) => arc.toString()).join(".") + " }";
                case (values_1.ASN1UniversalType.time): return `"${this.time}"`;
                case (values_1.ASN1UniversalType.sequence): return ("{ " + this.sequenceOf
                    .map((el) => (el.name.length ? `${el.name} ${el.toString()}` : el.toString()))
                    .join(" , ") + " }");
                case (values_1.ASN1UniversalType.set): return ("{ " + this.setOf
                    .map((el) => (el.name.length ? `${el.name} ${el.toString()}` : el.toString()))
                    .join(" , ") + " }");
                case (values_1.ASN1UniversalType.numericString): return `"${this.numericString}"`;
                case (values_1.ASN1UniversalType.printableString): return `"${this.printableString}"`;
                case (values_1.ASN1UniversalType.teletexString): return "TeletexString";
                case (values_1.ASN1UniversalType.videotexString): return "VideotexString";
                case (values_1.ASN1UniversalType.ia5String): return `"${this.ia5String}"`;
                case (values_1.ASN1UniversalType.utcTime): return `"${this.utcTime.toISOString()}"`;
                case (values_1.ASN1UniversalType.generalizedTime): return `"${this.generalizedTime.toISOString()}"`;
                case (values_1.ASN1UniversalType.graphicString): return `"${this.graphicString}"`;
                case (values_1.ASN1UniversalType.visibleString): return `"${this.visibleString}"`;
                case (values_1.ASN1UniversalType.generalString): return `"${this.generalString}"`;
                case (values_1.ASN1UniversalType.universalString): return `"${this.universalString}"`;
                case (values_1.ASN1UniversalType.characterString): return "CHARACTER STRING";
                case (values_1.ASN1UniversalType.bmpString): return `"${this.bmpString}"`;
                case (values_1.ASN1UniversalType.date): return `"${this.date.toISOString()}"`;
                case (values_1.ASN1UniversalType.timeOfDay): {
                    const tod = this.timeOfDay;
                    return `"${tod.getUTCHours()}:${tod.getUTCMinutes()}:${tod.getUTCSeconds()}"`;
                }
                case (values_1.ASN1UniversalType.dateTime): return `"${this.dateTime.toISOString()}"`;
                case (values_1.ASN1UniversalType.duration): return this.duration.toString();
                case (values_1.ASN1UniversalType.oidIRI): return this.oidIRI;
                case (values_1.ASN1UniversalType.roidIRI): return this.relativeOIDIRI;
                default: {
                    return `[UNIV ${this.tagNumber}]: ${this.value.toString()}`;
                }
            }
        }
        else if (this.construction === values_1.ASN1Construction.constructed) {
            const inner = this.components;
            if (inner.length === 1) {
                return inner[0].toString();
            }
            else {
                return "{ " + inner.map((el) => el.toString()).join(", ") + " }";
            }
        }
        else if (this.tagClass === values_1.ASN1TagClass.context) {
            return `[CTXT ${this.tagNumber}]: ${this.value.toString()}`;
        }
        else if (this.tagClass === values_1.ASN1TagClass.private) {
            return `[PRIV ${this.tagNumber}]: ${this.value.toString()}`;
        }
        else {
            return `[APPL ${this.tagNumber}]: ${this.value.toString()}`;
        }
    }
    toJSON(recurse = true) {
        if (this.tagClass === values_1.ASN1TagClass.universal) {
            switch (this.tagNumber) {
                case (values_1.ASN1UniversalType.endOfContent): return undefined;
                case (values_1.ASN1UniversalType.boolean): return this.boolean;
                case (values_1.ASN1UniversalType.integer): {
                    const ret = this.integer;
                    if (typeof ret === "bigint") {
                        return ret.toString();
                    }
                    return ret;
                }
                case (values_1.ASN1UniversalType.bitString): {
                    const bits = this.bitString;
                    return {
                        length: bits.length,
                        value: Array.from((0, packBits_1.default)(bits)).map((byte) => byte.toString(16)).join(""),
                    };
                }
                case (values_1.ASN1UniversalType.octetString): return Array.from(this.octetString)
                    .map((byte) => byte.toString(16)).join("");
                case (values_1.ASN1UniversalType.nill): return null;
                case (values_1.ASN1UniversalType.objectIdentifier): return this.objectIdentifier.toJSON();
                case (values_1.ASN1UniversalType.objectDescriptor): return this.objectDescriptor;
                case (values_1.ASN1UniversalType.external): return this.external.toJSON();
                case (values_1.ASN1UniversalType.realNumber): {
                    const r = this.real;
                    if (Object.is(r, -0)) {
                        return "-0";
                    }
                    if (r === -Infinity) {
                        return "-INF";
                    }
                    if (r === Infinity) {
                        return "INF";
                    }
                    if (Number.isNaN(r)) {
                        return "NaN";
                    }
                    return r.toString();
                }
                case (values_1.ASN1UniversalType.enumerated): return this.enumerated.toString();
                case (values_1.ASN1UniversalType.embeddedPDV): return this.embeddedPDV.toJSON();
                case (values_1.ASN1UniversalType.utf8String): return this.utf8String;
                case (values_1.ASN1UniversalType.relativeOID): return this.relativeObjectIdentifier
                    .map((arc) => arc.toString()).join(".");
                case (values_1.ASN1UniversalType.time): return this.time;
                case (values_1.ASN1UniversalType.sequence): {
                    if (!recurse) {
                        return null;
                    }
                    return this.sequenceOf.map((el) => el.toJSON());
                }
                case (values_1.ASN1UniversalType.set): {
                    if (!recurse) {
                        return null;
                    }
                    return this.setOf.map((el) => el.toJSON());
                }
                case (values_1.ASN1UniversalType.numericString): return this.numericString;
                case (values_1.ASN1UniversalType.printableString): return this.printableString;
                case (values_1.ASN1UniversalType.teletexString): return String.fromCodePoint(...Array.from(this.teletexString));
                case (values_1.ASN1UniversalType.videotexString): return String.fromCodePoint(...Array.from(this.videotexString));
                case (values_1.ASN1UniversalType.ia5String): return this.ia5String;
                case (values_1.ASN1UniversalType.utcTime): return this.utcTime.toISOString();
                case (values_1.ASN1UniversalType.generalizedTime): return this.generalizedTime.toISOString();
                case (values_1.ASN1UniversalType.graphicString): return this.graphicString;
                case (values_1.ASN1UniversalType.visibleString): return this.visibleString;
                case (values_1.ASN1UniversalType.generalString): return this.generalString;
                case (values_1.ASN1UniversalType.universalString): return this.universalString;
                case (values_1.ASN1UniversalType.characterString): return this.characterString.toJSON();
                case (values_1.ASN1UniversalType.bmpString): return this.bmpString;
                case (values_1.ASN1UniversalType.date): return this.date.toISOString();
                case (values_1.ASN1UniversalType.timeOfDay): {
                    const tod = this.timeOfDay;
                    return `${tod.getUTCHours()}:${tod.getUTCMinutes()}:${tod.getUTCSeconds()}`;
                }
                case (values_1.ASN1UniversalType.dateTime): return this.dateTime.toISOString();
                case (values_1.ASN1UniversalType.duration): return this.duration.toString();
                case (values_1.ASN1UniversalType.oidIRI): return this.oidIRI;
                case (values_1.ASN1UniversalType.roidIRI): return this.relativeOIDIRI;
                default: {
                    return undefined;
                }
            }
        }
        else if ((this.construction === values_1.ASN1Construction.constructed) && recurse) {
            const inner = this.components;
            if (inner.length === 1) {
                return inner[0].toJSON();
            }
            else {
                return inner.map((el) => el.toJSON());
            }
        }
        else {
            return undefined;
        }
    }
}
ASN1Element.nestingRecursionLimit = 5;
exports.default = ASN1Element;
