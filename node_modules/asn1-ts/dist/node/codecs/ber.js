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
const asn1_1 = __importDefault(require("../asn1"));
const errors = __importStar(require("../errors"));
const values_1 = require("../values");
const x690_1 = __importDefault(require("../x690"));
const convertBytesToText_1 = __importDefault(require("../utils/convertBytesToText"));
const convertTextToBytes_1 = __importDefault(require("../utils/convertTextToBytes"));
const ObjectIdentifier_1 = __importDefault(require("../types/ObjectIdentifier"));
const encodeBoolean_1 = __importDefault(require("./x690/encoders/encodeBoolean"));
const decodeBoolean_1 = __importDefault(require("./ber/decoders/decodeBoolean"));
const encodeBitString_1 = __importDefault(require("./x690/encoders/encodeBitString"));
const decodeBitString_1 = __importDefault(require("./ber/decoders/decodeBitString"));
const encodeReal_1 = __importDefault(require("./x690/encoders/encodeReal"));
const decodeReal_1 = __importDefault(require("./ber/decoders/decodeReal"));
const encodeSequence_1 = __importDefault(require("./x690/encoders/encodeSequence"));
const decodeSequence_1 = __importDefault(require("./ber/decoders/decodeSequence"));
const encodeUTCTime_1 = __importDefault(require("./x690/encoders/encodeUTCTime"));
const decodeUTCTime_1 = __importDefault(require("./ber/decoders/decodeUTCTime"));
const encodeGeneralizedTime_1 = __importDefault(require("./x690/encoders/encodeGeneralizedTime"));
const decodeGeneralizedTime_1 = __importDefault(require("./ber/decoders/decodeGeneralizedTime"));
const encodeExternal_1 = __importDefault(require("../codecs/x690/encoders/encodeExternal"));
const encodeEmbeddedPDV_1 = __importDefault(require("../codecs/x690/encoders/encodeEmbeddedPDV"));
const encodeCharacterString_1 = __importDefault(require("../codecs/x690/encoders/encodeCharacterString"));
const decodeExternal_1 = __importDefault(require("../codecs/x690/decoders/decodeExternal"));
const decodeEmbeddedPDV_1 = __importDefault(require("../codecs/x690/decoders/decodeEmbeddedPDV"));
const decodeCharacterString_1 = __importDefault(require("../codecs/x690/decoders/decodeCharacterString"));
const encodeGraphicString_1 = __importDefault(require("../codecs/ber/encoders/encodeGraphicString"));
const encodeNumericString_1 = __importDefault(require("../codecs/ber/encoders/encodeNumericString"));
const encodeObjectDescriptor_1 = __importDefault(require("../codecs/ber/encoders/encodeObjectDescriptor"));
const encodePrintableString_1 = __importDefault(require("../codecs/ber/encoders/encodePrintableString"));
const encodeVisibleString_1 = __importDefault(require("../codecs/ber/encoders/encodeVisibleString"));
const encodeGeneralString_1 = __importDefault(require("../codecs/ber/encoders/encodeGeneralString"));
const decodeGraphicString_1 = __importDefault(require("../codecs/x690/decoders/decodeGraphicString"));
const decodeNumericString_1 = __importDefault(require("../codecs/x690/decoders/decodeNumericString"));
const decodeObjectDescriptor_1 = __importDefault(require("../codecs/x690/decoders/decodeObjectDescriptor"));
const decodePrintableString_1 = __importDefault(require("../codecs/x690/decoders/decodePrintableString"));
const decodeVisibleString_1 = __importDefault(require("../codecs/x690/decoders/decodeVisibleString"));
const decodeGeneralString_1 = __importDefault(require("../codecs/x690/decoders/decodeGeneralString"));
const encodeDuration_1 = __importDefault(require("../codecs/x690/encoders/encodeDuration"));
const decodeDuration_1 = __importDefault(require("../codecs/ber/decoders/decodeDuration"));
const macros_1 = require("../macros");
const utils_1 = require("../utils");
const node_buffer_1 = require("node:buffer");
class BERElement extends x690_1.default {
    get value() {
        if (this._value instanceof Uint8Array) {
            return this._value;
        }
        const bytes = (0, encodeSequence_1.default)(this._value);
        this._value = bytes;
        return bytes;
    }
    set value(v) {
        this._currentValueLength = v.length;
        this._value = v;
    }
    construct(els) {
        this._currentValueLength = undefined;
        this._value = els;
    }
    set boolean(value) {
        this.value = (0, encodeBoolean_1.default)(value);
    }
    get boolean() {
        if (this.construction !== values_1.ASN1Construction.primitive) {
            throw new errors.ASN1ConstructionError("BOOLEAN cannot be constructed.", this);
        }
        return (0, decodeBoolean_1.default)(this.value);
    }
    set bitString(value) {
        this.value = (0, encodeBitString_1.default)(value);
    }
    get bitString() {
        if (this.construction === values_1.ASN1Construction.primitive) {
            return (0, decodeBitString_1.default)(this.value);
        }
        if ((this.recursionCount + 1) > BERElement.nestingRecursionLimit) {
            throw new errors.ASN1RecursionError();
        }
        const appendy = [];
        const substrings = this.sequence;
        for (const substring of substrings.slice(0, (substrings.length - 1))) {
            if (substring.construction === values_1.ASN1Construction.primitive
                && substring.value.length > 0
                && substring.value[0] !== 0x00) {
                throw new errors.ASN1Error("Only the last subelement of a constructed BIT STRING may have a non-zero first value byte.", this);
            }
        }
        for (const substring of substrings) {
            if (substring.tagClass !== this.tagClass) {
                throw new errors.ASN1ConstructionError("Invalid tag class in recursively-encoded BIT STRING.", this);
            }
            if (substring.tagNumber !== this.tagNumber) {
                throw new errors.ASN1ConstructionError("Invalid tag class in recursively-encoded BIT STRING.", this);
            }
            substring.recursionCount = (this.recursionCount + 1);
            appendy.push(...Array.from(substring.bitString).map((b) => b !== macros_1.FALSE_BIT));
        }
        return new Uint8ClampedArray(appendy.map((b) => (b ? 1 : 0)));
    }
    set octetString(value) {
        this.value = new Uint8Array(value);
    }
    get octetString() {
        return this.deconstruct("OCTET STRING");
    }
    set objectDescriptor(value) {
        this.value = (0, encodeObjectDescriptor_1.default)(value);
    }
    get objectDescriptor() {
        const bytes = this.deconstruct("ObjectDescriptor");
        return (0, decodeObjectDescriptor_1.default)(bytes);
    }
    set external(value) {
        this.value = (0, encodeExternal_1.default)(value);
        this.construction = values_1.ASN1Construction.constructed;
    }
    get external() {
        return (0, decodeExternal_1.default)(this.value);
    }
    set real(value) {
        this.value = (0, encodeReal_1.default)(value);
    }
    get real() {
        if (this.construction !== values_1.ASN1Construction.primitive) {
            throw new errors.ASN1ConstructionError("REAL cannot be constructed.");
        }
        return (0, decodeReal_1.default)(this.value);
    }
    set embeddedPDV(value) {
        this.value = (0, encodeEmbeddedPDV_1.default)(value);
        this.construction = values_1.ASN1Construction.constructed;
    }
    get embeddedPDV() {
        return (0, decodeEmbeddedPDV_1.default)(this.value);
    }
    set utf8String(value) {
        this.value = (0, convertTextToBytes_1.default)(value);
    }
    get utf8String() {
        return (0, convertBytesToText_1.default)(this.deconstruct("UTF8String"));
    }
    set sequence(value) {
        this.construct(value);
        this.construction = values_1.ASN1Construction.constructed;
    }
    get sequence() {
        if (this.construction !== values_1.ASN1Construction.constructed) {
            throw new errors.ASN1ConstructionError("SET or SEQUENCE cannot be primitively constructed.", this);
        }
        if (Array.isArray(this._value)) {
            return this._value;
        }
        return (0, decodeSequence_1.default)(this.value);
    }
    set set(value) {
        this.sequence = value;
    }
    get set() {
        const ret = this.sequence;
        if (!(0, utils_1.isUniquelyTagged)(ret)) {
            throw new errors.ASN1ConstructionError("Duplicate tag in SET.", this);
        }
        return ret;
    }
    set sequenceOf(value) {
        this.construct(value);
        this.construction = values_1.ASN1Construction.constructed;
    }
    get sequenceOf() {
        if (this.construction !== values_1.ASN1Construction.constructed) {
            throw new errors.ASN1ConstructionError("SET or SEQUENCE cannot be primitively constructed.", this);
        }
        if (Array.isArray(this._value)) {
            return this._value;
        }
        return (0, decodeSequence_1.default)(this.value);
    }
    set setOf(value) {
        this.sequence = value;
    }
    get setOf() {
        return this.sequence;
    }
    set numericString(value) {
        this.value = (0, encodeNumericString_1.default)(value);
    }
    get numericString() {
        const bytes = this.deconstruct("NumericString");
        return (0, decodeNumericString_1.default)(bytes);
    }
    set printableString(value) {
        this.value = (0, encodePrintableString_1.default)(value);
    }
    get printableString() {
        const bytes = this.deconstruct("PrintableString");
        return (0, decodePrintableString_1.default)(bytes);
    }
    set teletexString(value) {
        this.value = new Uint8Array(value);
    }
    get teletexString() {
        return this.deconstruct("TeletexString");
    }
    set videotexString(value) {
        this.value = new Uint8Array(value);
    }
    get videotexString() {
        return this.deconstruct("VideotexString");
    }
    set ia5String(value) {
        this.value = (0, convertTextToBytes_1.default)(value);
    }
    get ia5String() {
        return (0, convertBytesToText_1.default)(this.deconstruct("IA5String"));
    }
    set utcTime(value) {
        this.value = (0, encodeUTCTime_1.default)(value);
    }
    get utcTime() {
        return (0, decodeUTCTime_1.default)(this.deconstruct("UTCTime"));
    }
    set generalizedTime(value) {
        this.value = (0, encodeGeneralizedTime_1.default)(value);
    }
    get generalizedTime() {
        return (0, decodeGeneralizedTime_1.default)(this.deconstruct("GeneralizedTime"));
    }
    set graphicString(value) {
        this.value = (0, encodeGraphicString_1.default)(value);
    }
    get graphicString() {
        const bytes = this.deconstruct("GraphicString");
        return (0, decodeGraphicString_1.default)(bytes);
    }
    set visibleString(value) {
        this.value = (0, encodeVisibleString_1.default)(value);
    }
    get visibleString() {
        return (0, decodeVisibleString_1.default)(this.value);
    }
    set generalString(value) {
        this.value = (0, encodeGeneralString_1.default)(value);
    }
    get generalString() {
        const bytes = this.deconstruct("GeneralString");
        return (0, decodeGeneralString_1.default)(bytes);
    }
    set characterString(value) {
        this.value = (0, encodeCharacterString_1.default)(value);
        this.construction = values_1.ASN1Construction.constructed;
    }
    get characterString() {
        return (0, decodeCharacterString_1.default)(this.value);
    }
    set universalString(value) {
        const buf = new Uint8Array(value.length << 2);
        for (let i = 0; i < value.length; i++) {
            buf[(i << 2)] = value.charCodeAt(i) >>> 24;
            buf[(i << 2) + 1] = value.charCodeAt(i) >>> 16;
            buf[(i << 2) + 2] = value.charCodeAt(i) >>> 8;
            buf[(i << 2) + 3] = value.charCodeAt(i);
        }
        this.value = buf;
    }
    get universalString() {
        const valueBytes = this.deconstruct("UniversalString");
        if (valueBytes.length % 4) {
            throw new errors.ASN1Error("UniversalString encoded on non-mulitple of four bytes.", this);
        }
        let ret = "";
        for (let i = 0; i < valueBytes.length; i += 4) {
            ret += String.fromCharCode((valueBytes[i + 0] << 24)
                + (valueBytes[i + 1] << 16)
                + (valueBytes[i + 2] << 8)
                + (valueBytes[i + 3] << 0));
        }
        return ret;
    }
    set bmpString(value) {
        const buf = new Uint8Array(value.length << 1);
        for (let i = 0, strLen = value.length; i < strLen; i++) {
            buf[(i << 1)] = value.charCodeAt(i) >>> 8;
            buf[(i << 1) + 1] = value.charCodeAt(i);
        }
        this.value = buf;
    }
    get bmpString() {
        const valueBytes = this.deconstruct("BMPString");
        if (valueBytes.length % 2)
            throw new errors.ASN1Error("BMPString encoded on non-mulitple of two bytes.", this);
        if (typeof node_buffer_1.Buffer !== "undefined") {
            const swappedEndianness = node_buffer_1.Buffer.allocUnsafe(valueBytes.length);
            for (let i = 0; i < valueBytes.length; i += 2) {
                swappedEndianness[i] = valueBytes[i + 1];
                swappedEndianness[i + 1] = valueBytes[i];
            }
            return swappedEndianness.toString("utf16le");
        }
        else if (typeof TextEncoder !== "undefined") {
            return (new TextDecoder("utf-16be")).decode(valueBytes.buffer);
        }
        else {
            throw new errors.ASN1Error("Neither TextDecoder nor Buffer are defined to decode bytes into text.", this);
        }
    }
    set duration(value) {
        this.value = (0, encodeDuration_1.default)(value);
    }
    get duration() {
        return (0, decodeDuration_1.default)(this.value);
    }
    encode(value) {
        switch (typeof value) {
            case ("undefined"): {
                this.value = new Uint8Array(0);
                break;
            }
            case ("boolean"): {
                this.tagNumber = values_1.ASN1UniversalType.boolean;
                this.boolean = value;
                break;
            }
            case ("number"): {
                if (Number.isInteger(value)) {
                    this.tagNumber = values_1.ASN1UniversalType.integer;
                    this.integer = value;
                }
                else {
                    this.tagNumber = values_1.ASN1UniversalType.realNumber;
                    this.real = value;
                }
                break;
            }
            case ("bigint"): {
                this.tagNumber = values_1.ASN1UniversalType.integer;
                this.integer = value;
                break;
            }
            case ("string"): {
                this.tagNumber = values_1.ASN1UniversalType.utf8String;
                this.utf8String = value;
                break;
            }
            case ("object"): {
                if (!value) {
                    this.tagNumber = values_1.ASN1UniversalType.nill;
                    this.value = new Uint8Array(0);
                }
                else if (value instanceof Uint8Array) {
                    this.tagNumber = values_1.ASN1UniversalType.octetString;
                    this.octetString = value;
                }
                else if (value instanceof Uint8ClampedArray) {
                    this.tagNumber = values_1.ASN1UniversalType.bitString;
                    this.bitString = value;
                }
                else if (value instanceof asn1_1.default) {
                    this.construction = values_1.ASN1Construction.constructed;
                    this.sequence = [value];
                }
                else if (value instanceof Set) {
                    this.construction = values_1.ASN1Construction.constructed;
                    this.set = Array.from(value).map((v) => {
                        if (typeof v === "object" && v instanceof asn1_1.default) {
                            return v;
                        }
                        else {
                            const e = new BERElement();
                            e.encode(v);
                            return e;
                        }
                    });
                }
                else if ((value instanceof ObjectIdentifier_1.default) || (value.constructor?.name === "ObjectIdentifier")) {
                    this.tagNumber = values_1.ASN1UniversalType.objectIdentifier;
                    this.objectIdentifier = value;
                }
                else if (Array.isArray(value)) {
                    this.construction = values_1.ASN1Construction.constructed;
                    this.tagNumber = values_1.ASN1UniversalType.sequence;
                    this.sequence = value.map((sub) => {
                        const ret = new BERElement();
                        ret.encode(sub);
                        return ret;
                    });
                }
                else if (value instanceof Date) {
                    this.generalizedTime = value;
                }
                else {
                    throw new errors.ASN1Error(`Cannot encode value of type ${value.constructor.name}.`, this);
                }
                break;
            }
            default: {
                throw new errors.ASN1Error(`Cannot encode value of type ${typeof value}.`, this);
            }
        }
    }
    static fromSequence(sequence) {
        const ret = new BERElement(values_1.ASN1TagClass.universal, values_1.ASN1Construction.constructed, values_1.ASN1UniversalType.sequence);
        ret.sequence = sequence.filter((element) => Boolean(element));
        return ret;
    }
    static fromSet(set) {
        const ret = new BERElement(values_1.ASN1TagClass.universal, values_1.ASN1Construction.constructed, values_1.ASN1UniversalType.set);
        ret.set = set.filter((element) => Boolean(element));
        return ret;
    }
    static fromSetOf(set) {
        const ret = new BERElement(values_1.ASN1TagClass.universal, values_1.ASN1Construction.constructed, values_1.ASN1UniversalType.set);
        ret.setOf = set.filter((element) => Boolean(element));
        return ret;
    }
    get inner() {
        if (this.construction !== values_1.ASN1Construction.constructed) {
            throw new errors.ASN1ConstructionError("An explicitly-encoded element cannot be encoded using "
                + "primitive construction.", this);
        }
        if (Array.isArray(this._value)) {
            if (this._value.length !== 1) {
                throw new errors.ASN1ConstructionError(`An explicitly-encoding element contained ${this._value.length} encoded elements.`, this);
            }
            return this._value[0];
        }
        const ret = new BERElement();
        const readBytes = ret.fromBytes(this._value);
        if (readBytes !== this._value.length) {
            throw new errors.ASN1ConstructionError("An explicitly-encoding element contained more than one single "
                + "encoded element. The tag number of the first decoded "
                + `element was ${ret.tagNumber}, and it was encoded on `
                + `${readBytes} bytes.`, this);
        }
        return ret;
    }
    set inner(value) {
        this.construction = values_1.ASN1Construction.constructed;
        this._value = [value];
    }
    constructor(tagClass = values_1.ASN1TagClass.universal, construction = values_1.ASN1Construction.primitive, tagNumber = values_1.ASN1UniversalType.endOfContent, value = undefined) {
        super();
        this._value = new Uint8Array(0);
        this.encode(value);
        this.tagClass = tagClass;
        this.construction = construction;
        this.tagNumber = tagNumber;
    }
    fromBytes(bytes) {
        if (bytes.length < 2) {
            throw new errors.ASN1TruncationError("Tried to decode a BER element that is less than two bytes.", this);
        }
        if ((this.recursionCount + 1) > BERElement.nestingRecursionLimit) {
            throw new errors.ASN1RecursionError();
        }
        let cursor = 0;
        switch (bytes[cursor] & 0b11000000) {
            case (0b00000000):
                this.tagClass = values_1.ASN1TagClass.universal;
                break;
            case (0b01000000):
                this.tagClass = values_1.ASN1TagClass.application;
                break;
            case (0b10000000):
                this.tagClass = values_1.ASN1TagClass.context;
                break;
            case (0b11000000):
                this.tagClass = values_1.ASN1TagClass.private;
                break;
            default: this.tagClass = values_1.ASN1TagClass.universal;
        }
        this.construction = ((bytes[cursor] & 0b00100000)
            ? values_1.ASN1Construction.constructed : values_1.ASN1Construction.primitive);
        this.tagNumber = (bytes[cursor] & 0b00011111);
        cursor++;
        if (this.tagNumber >= 31) {
            if (bytes[cursor] === 0b10000000) {
                throw new errors.ASN1PaddingError("Leading padding byte on long tag number encoding.", this);
            }
            this.tagNumber = 0;
            const limit = (((bytes.length - 1) >= 4) ? 4 : (bytes.length - 1));
            while (cursor < limit) {
                if (!(bytes[cursor++] & 0b10000000))
                    break;
            }
            if (bytes[cursor - 1] & 0b10000000) {
                if (limit === (bytes.length - 1)) {
                    throw new errors.ASN1TruncationError("ASN.1 tag number appears to have been truncated.", this);
                }
                else {
                    throw new errors.ASN1OverflowError("ASN.1 tag number too large.", this);
                }
            }
            for (let i = 1; i < cursor; i++) {
                this.tagNumber <<= 7;
                this.tagNumber |= (bytes[i] & 0x7F);
            }
        }
        if ((bytes[cursor] & 0b10000000) === 0b10000000) {
            const numberOfLengthOctets = (bytes[cursor] & 0x7F);
            if (numberOfLengthOctets) {
                if (numberOfLengthOctets === 0b01111111) {
                    throw new errors.ASN1UndefinedError("Length byte with undefined meaning encountered.", this);
                }
                if (numberOfLengthOctets > 4) {
                    throw new errors.ASN1OverflowError(`Element length too long to decode to an integer. Content octets occupied ${numberOfLengthOctets} bytes.`, this);
                }
                if (cursor + numberOfLengthOctets >= bytes.length) {
                    throw new errors.ASN1TruncationError("Element length bytes appear to have been truncated.", this);
                }
                cursor++;
                const lengthNumberOctets = new Uint8Array(4);
                for (let i = numberOfLengthOctets; i > 0; i--) {
                    lengthNumberOctets[(4 - i)] = bytes[(cursor + numberOfLengthOctets - i)];
                }
                let length = 0;
                for (const octet of lengthNumberOctets) {
                    length <<= 8;
                    length += octet;
                }
                if ((cursor + length) < cursor) {
                    throw new errors.ASN1OverflowError("ASN.1 element too large.", this);
                }
                cursor += (numberOfLengthOctets);
                if ((cursor + length) > bytes.length) {
                    throw new errors.ASN1TruncationError("ASN.1 element truncated.", this);
                }
                this.value = bytes.slice(cursor, (cursor + length));
                return (cursor + length);
            }
            else {
                if (this.construction !== values_1.ASN1Construction.constructed) {
                    throw new errors.ASN1ConstructionError("Indefinite length ASN.1 element was not of constructed construction.", this);
                }
                const startOfValue = ++cursor;
                let sentinel = cursor;
                while (sentinel < bytes.length) {
                    const child = new BERElement();
                    sentinel += child.fromBytes(bytes.subarray(sentinel));
                    if (child.tagClass === values_1.ASN1TagClass.universal
                        && child.construction === values_1.ASN1Construction.primitive
                        && child.tagNumber === values_1.ASN1UniversalType.endOfContent
                        && child.value.length === 0)
                        break;
                }
                if (sentinel === bytes.length && (bytes[sentinel - 1] !== 0x00 || bytes[sentinel - 2] !== 0x00)) {
                    throw new errors.ASN1TruncationError("No END OF CONTENT element found at the end of indefinite length ASN.1 element.", this);
                }
                this.value = bytes.slice(startOfValue, (sentinel - 2));
                return sentinel;
            }
        }
        else {
            const length = (bytes[cursor++] & 0x7F);
            if ((cursor + length) > bytes.length) {
                throw new errors.ASN1TruncationError("ASN.1 element was truncated.", this);
            }
            this.value = bytes.slice(cursor, (cursor + length));
            return (cursor + length);
        }
    }
    lengthLength(valueLength) {
        if (BERElement.lengthEncodingPreference === values_1.LengthEncodingPreference.indefinite) {
            return 1;
        }
        const len = valueLength ?? this.valueLength();
        if (len < 127) {
            return 1;
        }
        let lengthOctets = [0, 0, 0, 0];
        for (let i = 0; i < 4; i++) {
            lengthOctets[i] = ((len >>> ((3 - i) << 3)) & 0xFF);
        }
        let startOfNonPadding = 0;
        for (let i = 0; i < (lengthOctets.length - 1); i++) {
            if (lengthOctets[i] === 0x00)
                startOfNonPadding++;
        }
        return 5 - startOfNonPadding;
    }
    valueLength() {
        if (this._currentValueLength !== undefined) {
            return this._currentValueLength;
        }
        if (!Array.isArray(this._value)) {
            return this._value.length;
        }
        let len = 0;
        for (const el of this._value) {
            len += el.tlvLength();
        }
        this._currentValueLength = len;
        return len;
    }
    tlvLength() {
        const eoc_bytes = (BERElement.lengthEncodingPreference === values_1.LengthEncodingPreference.indefinite)
            ? 2
            : 0;
        const value_len = this.valueLength();
        return (this.tagLength()
            + this.lengthLength(value_len)
            + value_len
            + eoc_bytes);
    }
    tagAndLengthBytes() {
        const tagBytes = [0x00];
        tagBytes[0] |= (this.tagClass << 6);
        tagBytes[0] |= ((BERElement.lengthEncodingPreference === values_1.LengthEncodingPreference.indefinite)
            || this.construction === values_1.ASN1Construction.constructed)
            ? (1 << 5)
            : 0;
        if (this.tagNumber < 31) {
            tagBytes[0] |= this.tagNumber;
        }
        else {
            tagBytes[0] |= 0b00011111;
            let number = this.tagNumber;
            const encodedNumber = [];
            while (number !== 0) {
                encodedNumber.unshift(number & 0x7F);
                number >>>= 7;
                encodedNumber[0] |= 0b10000000;
            }
            encodedNumber[encodedNumber.length - 1] &= 0b01111111;
            tagBytes.push(...encodedNumber);
        }
        let lengthOctets = [0x00];
        const value_len = this.valueLength();
        switch (BERElement.lengthEncodingPreference) {
            case (values_1.LengthEncodingPreference.definite): {
                if (value_len < 127) {
                    lengthOctets[0] = value_len;
                }
                else {
                    lengthOctets = [0, 0, 0, 0];
                    for (let i = 0; i < 4; i++) {
                        lengthOctets[i] = ((value_len >>> ((3 - i) << 3)) & 0xFF);
                    }
                    let startOfNonPadding = 0;
                    for (let i = 0; i < (lengthOctets.length - 1); i++) {
                        if (lengthOctets[i] === 0x00)
                            startOfNonPadding++;
                    }
                    lengthOctets = lengthOctets.slice(startOfNonPadding);
                    lengthOctets.unshift(0b10000000 | lengthOctets.length);
                }
                break;
            }
            case (values_1.LengthEncodingPreference.indefinite): {
                lengthOctets = [0b10000000];
                break;
            }
            default:
                throw new errors.ASN1UndefinedError("Invalid LengthEncodingPreference encountered!", this);
        }
        const ret = new Uint8Array(tagBytes.length + lengthOctets.length);
        ret.set(tagBytes, 0);
        ret.set(lengthOctets, tagBytes.length);
        return ret;
    }
    toBuffers() {
        return [
            this.tagAndLengthBytes(),
            ...(Array.isArray(this._value)
                ? this._value.flatMap((el) => el.toBuffers())
                : [this._value]),
            ...(BERElement.lengthEncodingPreference === values_1.LengthEncodingPreference.indefinite
                ? [new Uint8Array(2)]
                : []),
        ];
    }
    deconstruct(dataType) {
        if (this.construction === values_1.ASN1Construction.primitive) {
            return this.value;
        }
        else {
            if ((this.recursionCount + 1) > BERElement.nestingRecursionLimit)
                throw new errors.ASN1RecursionError();
            const appendy = [];
            const substrings = this.sequence;
            for (const substring of substrings) {
                if (substring.tagClass !== values_1.ASN1TagClass.universal) {
                    throw new errors.ASN1ConstructionError(`Invalid tag class in constructed ${dataType}. Must be UNIVERSAL`, this);
                }
                if (substring.tagNumber !== values_1.ASN1UniversalType.octetString) {
                    throw new errors.ASN1ConstructionError(`Invalid tag number in constructed ${dataType}. Must be 4 (OCTET STRING).`, this);
                }
                substring.recursionCount = (this.recursionCount + 1);
                const deconstructed = substring.deconstruct(dataType);
                appendy.push(deconstructed);
            }
            return node_buffer_1.Buffer.concat(appendy);
        }
    }
    get components() {
        if (Array.isArray(this._value)) {
            return this._value;
        }
        const encodedElements = [];
        let i = 0;
        while (i < this._value.length) {
            const next = new BERElement();
            i += next.fromBytes(this.value.subarray(i));
            encodedElements.push(next);
        }
        return encodedElements;
    }
}
BERElement.lengthEncodingPreference = values_1.LengthEncodingPreference.definite;
exports.default = BERElement;
