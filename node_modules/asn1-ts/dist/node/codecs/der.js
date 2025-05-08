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
const convertBytesToText_1 = __importDefault(require("../utils/convertBytesToText"));
const convertTextToBytes_1 = __importDefault(require("../utils/convertTextToBytes"));
const sortCanonically_1 = __importDefault(require("../utils/sortCanonically"));
const ObjectIdentifier_1 = __importDefault(require("../types/ObjectIdentifier"));
const encodeBoolean_1 = __importDefault(require("./x690/encoders/encodeBoolean"));
const decodeBoolean_1 = __importDefault(require("./der/decoders/decodeBoolean"));
const encodeBitString_1 = __importDefault(require("./x690/encoders/encodeBitString"));
const decodeBitString_1 = __importDefault(require("./der/decoders/decodeBitString"));
const encodeReal_1 = __importDefault(require("./x690/encoders/encodeReal"));
const decodeReal_1 = __importDefault(require("./der/decoders/decodeReal"));
const encodeSequence_1 = __importDefault(require("./x690/encoders/encodeSequence"));
const decodeSequence_1 = __importDefault(require("./der/decoders/decodeSequence"));
const encodeUTCTime_1 = __importDefault(require("./x690/encoders/encodeUTCTime"));
const decodeUTCTime_1 = __importDefault(require("./der/decoders/decodeUTCTime"));
const encodeGeneralizedTime_1 = __importDefault(require("./x690/encoders/encodeGeneralizedTime"));
const decodeGeneralizedTime_1 = __importDefault(require("./der/decoders/decodeGeneralizedTime"));
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
const decodeDuration_1 = __importDefault(require("../codecs/der/decoders/decodeDuration"));
const x690_1 = __importDefault(require("../x690"));
const utils_1 = require("../utils");
const node_buffer_1 = require("node:buffer");
class DERElement extends x690_1.default {
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
        if (this.construction !== values_1.ASN1Construction.primitive) {
            throw new errors.ASN1ConstructionError("BIT STRING cannot be constructed.", this);
        }
        return (0, decodeBitString_1.default)(this.value);
    }
    set octetString(value) {
        this.value = new Uint8Array(value);
    }
    get octetString() {
        if (this.construction !== values_1.ASN1Construction.primitive) {
            throw new errors.ASN1ConstructionError("OCTET STRING cannot be constructed.", this);
        }
        return new Uint8Array(this.value);
    }
    set objectDescriptor(value) {
        this.value = (0, encodeObjectDescriptor_1.default)(value);
    }
    get objectDescriptor() {
        return (0, decodeObjectDescriptor_1.default)(this.value);
    }
    set external(value) {
        this.value = (0, encodeExternal_1.default)(value);
        this.construction = values_1.ASN1Construction.constructed;
    }
    get external() {
        if (this.construction !== values_1.ASN1Construction.constructed) {
            throw new errors.ASN1ConstructionError("EXTERNAL cannot be primitively-constructed.", this);
        }
        return (0, decodeExternal_1.default)(this.value);
    }
    set real(value) {
        this.value = (0, encodeReal_1.default)(value);
    }
    get real() {
        if (this.construction !== values_1.ASN1Construction.primitive) {
            throw new errors.ASN1ConstructionError("REAL cannot be constructed.", this);
        }
        return (0, decodeReal_1.default)(this.value);
    }
    set embeddedPDV(value) {
        this.value = (0, encodeEmbeddedPDV_1.default)(value);
        this.construction = values_1.ASN1Construction.constructed;
    }
    get embeddedPDV() {
        if (this.construction !== values_1.ASN1Construction.constructed) {
            throw new errors.ASN1ConstructionError("EMBEDDED PDV cannot be primitively-constructed.", this);
        }
        return (0, decodeEmbeddedPDV_1.default)(this.value);
    }
    set utf8String(value) {
        this.value = (0, convertTextToBytes_1.default)(value);
    }
    get utf8String() {
        if (this.construction !== values_1.ASN1Construction.primitive) {
            throw new errors.ASN1ConstructionError("UTF8String cannot be constructed.", this);
        }
        return (0, convertBytesToText_1.default)(this.value);
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
        (0, sortCanonically_1.default)(value);
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
        if (this.construction !== values_1.ASN1Construction.primitive) {
            throw new errors.ASN1ConstructionError("NumericString cannot be constructed.", this);
        }
        return (0, decodeNumericString_1.default)(this.value);
    }
    set printableString(value) {
        this.value = (0, encodePrintableString_1.default)(value);
    }
    get printableString() {
        if (this.construction !== values_1.ASN1Construction.primitive) {
            throw new errors.ASN1ConstructionError("PrintableString cannot be constructed.", this);
        }
        return (0, decodePrintableString_1.default)(this.value);
    }
    set teletexString(value) {
        this.value = new Uint8Array(value);
    }
    get teletexString() {
        return this.octetString;
    }
    set videotexString(value) {
        this.value = new Uint8Array(value);
    }
    get videotexString() {
        return this.octetString;
    }
    set ia5String(value) {
        this.value = (0, convertTextToBytes_1.default)(value);
    }
    get ia5String() {
        if (this.construction !== values_1.ASN1Construction.primitive) {
            throw new errors.ASN1ConstructionError("IA5String cannot be constructed.", this);
        }
        return (0, convertBytesToText_1.default)(this.value);
    }
    set utcTime(value) {
        this.value = (0, encodeUTCTime_1.default)(value);
    }
    get utcTime() {
        if (this.construction !== values_1.ASN1Construction.primitive) {
            throw new errors.ASN1ConstructionError("UTCTime cannot be constructed.", this);
        }
        return (0, decodeUTCTime_1.default)(this.value);
    }
    set generalizedTime(value) {
        this.value = (0, encodeGeneralizedTime_1.default)(value);
    }
    get generalizedTime() {
        if (this.construction !== values_1.ASN1Construction.primitive) {
            throw new errors.ASN1ConstructionError("GeneralizedTime cannot be constructed.", this);
        }
        return (0, decodeGeneralizedTime_1.default)(this.value);
    }
    set graphicString(value) {
        this.value = (0, encodeGraphicString_1.default)(value);
    }
    get graphicString() {
        if (this.construction !== values_1.ASN1Construction.primitive) {
            throw new errors.ASN1ConstructionError("GraphicString cannot be constructed.", this);
        }
        return (0, decodeGraphicString_1.default)(this.value);
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
        if (this.construction !== values_1.ASN1Construction.primitive) {
            throw new errors.ASN1ConstructionError("GeneralString cannot be constructed.", this);
        }
        return (0, decodeGeneralString_1.default)(this.value);
    }
    set characterString(value) {
        this.value = (0, encodeCharacterString_1.default)(value);
        this.construction = values_1.ASN1Construction.constructed;
    }
    get characterString() {
        if (this.construction !== values_1.ASN1Construction.constructed) {
            throw new errors.ASN1ConstructionError("CHARACTER STRING cannot be primitively-constructed.", this);
        }
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
        if (this.construction !== values_1.ASN1Construction.primitive) {
            throw new errors.ASN1ConstructionError("UniversalString cannot be constructed.", this);
        }
        if (this.value.length % 4) {
            throw new errors.ASN1Error("UniversalString encoded on non-mulitple of four bytes.", this);
        }
        let ret = "";
        for (let i = 0; i < this.value.length; i += 4) {
            ret += String.fromCharCode((this.value[i + 0] << 24)
                + (this.value[i + 1] << 16)
                + (this.value[i + 2] << 8)
                + (this.value[i + 3] << 0));
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
        if (this.construction !== values_1.ASN1Construction.primitive) {
            throw new errors.ASN1ConstructionError("BMPString cannot be constructed.", this);
        }
        if (this.value.length % 2)
            throw new errors.ASN1Error("BMPString encoded on non-mulitple of two bytes.", this);
        if (typeof node_buffer_1.Buffer !== "undefined") {
            const swappedEndianness = node_buffer_1.Buffer.allocUnsafe(this.value.length);
            for (let i = 0; i < this.value.length; i += 2) {
                swappedEndianness[i] = this.value[i + 1];
                swappedEndianness[i + 1] = this.value[i];
            }
            return swappedEndianness.toString("utf16le");
        }
        else if (typeof TextEncoder !== "undefined") {
            return (new TextDecoder("utf-16be")).decode(new Uint8Array(this.value));
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
                            const e = new DERElement();
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
                        const ret = new DERElement();
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
        const ret = new DERElement(values_1.ASN1TagClass.universal, values_1.ASN1Construction.constructed, values_1.ASN1UniversalType.sequence);
        ret.sequence = sequence.filter((element) => Boolean(element));
        return ret;
    }
    static fromSet(set) {
        const ret = new DERElement(values_1.ASN1TagClass.universal, values_1.ASN1Construction.constructed, values_1.ASN1UniversalType.set);
        ret.set = set.filter((element) => Boolean(element));
        return ret;
    }
    static fromSetOf(set) {
        const ret = new DERElement(values_1.ASN1TagClass.universal, values_1.ASN1Construction.constructed, values_1.ASN1UniversalType.set);
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
        const ret = new DERElement();
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
            throw new errors.ASN1TruncationError("Tried to decode a DER element that is less than two bytes.", this);
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
            if (this.tagNumber < 31) {
                throw new errors.ASN1Error("ASN.1 tag number could have been encoded in short form.", this);
            }
        }
        if ((bytes[cursor] & 0b10000000) === 0b10000000) {
            const numberOfLengthOctets = (bytes[cursor] & 0x7F);
            if (numberOfLengthOctets === 0b01111111) {
                throw new errors.ASN1UndefinedError("Length byte with undefined meaning encountered.", this);
            }
            if (numberOfLengthOctets > 4) {
                throw new errors.ASN1OverflowError("Element length too long to decode to an integer.", this);
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
            if (((length <= 127 && length >= -128) && numberOfLengthOctets > 1)
                || ((length <= 32767 && length >= -32768) && numberOfLengthOctets > 2)
                || ((length <= 8388607 && length >= -8388608) && numberOfLengthOctets > 3)) {
                throw new errors.ASN1PaddingError("DER-encoded long-form length encoded on more octets than necessary", this);
            }
            this.value = bytes.slice(cursor, (cursor + length));
            return (cursor + length);
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
    tagAndLengthBytes() {
        const tagBytes = [0x00];
        tagBytes[0] |= (this.tagClass << 6);
        tagBytes[0] |= (this.construction << 5);
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
        if (this.value.length < 127) {
            lengthOctets[0] = this.value.length;
        }
        else {
            const length = this.value.length;
            lengthOctets = [0, 0, 0, 0];
            for (let i = 0; i < 4; i++) {
                lengthOctets[i] = ((length >>> ((3 - i) << 3)) & 0xFF);
            }
            let startOfNonPadding = 0;
            for (let i = 0; i < (lengthOctets.length - 1); i++) {
                if (lengthOctets[i] === 0x00)
                    startOfNonPadding++;
            }
            lengthOctets = lengthOctets.slice(startOfNonPadding);
            lengthOctets.unshift(0b10000000 | lengthOctets.length);
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
        ];
    }
    deconstruct() {
        return new Uint8Array(this.value);
    }
    get components() {
        if (Array.isArray(this._value)) {
            return this._value;
        }
        const encodedElements = [];
        let i = 0;
        while (i < this._value.length) {
            const next = new DERElement();
            i += next.fromBytes(this.value.subarray(i));
            encodedElements.push(next);
        }
        return encodedElements;
    }
    lengthLength(valueLength) {
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
        const value_len = this.valueLength();
        return (this.tagLength()
            + this.lengthLength(value_len)
            + value_len);
    }
}
exports.default = DERElement;
