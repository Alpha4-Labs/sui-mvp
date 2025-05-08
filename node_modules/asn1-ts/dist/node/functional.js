"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports._decodeEnumerated = exports._decodeEmbeddedPDV = exports._decodeDuration = exports._decodeDateTime = exports._decodeDate = exports._decodeUnrestrictedCharacterString = exports._decodeBoolean = exports._decodeBitString = exports._encodeAny = exports._encodeObjectDescriptor = exports._encodeUTCTime = exports._encodeGeneralizedTime = exports._encodeVisibleString = exports._encodeVideotexString = exports._encodeUTF8String = exports._encodeUniversalString = exports._encodeT61String = exports._encodeTeletexString = exports._encodePrintableString = exports._encodeNumericString = exports._encodeISO646String = exports._encodeIA5String = exports._encodeGraphicString = exports._encodeGeneralString = exports._encodeBMPString = exports._encodeTimeOfDay = exports._encodeTime = exports._encodeSet = exports._encodeSequence = exports._encodeRelativeOID = exports._encodeRelativeIRI = exports._encodeReal = exports._encodeOctetString = exports._encodeObjectIdentifier = exports._encodeNull = exports._encodeIRI = exports._encodeInteger = exports._encodeInstanceOf = exports._encodeExternal = exports._encodeEnumerated = exports._encodeEmbeddedPDV = exports._encodeDuration = exports._encodeDateTime = exports._encodeDate = exports._encodeUnrestrictedCharacterString = exports._encodeBoolean = exports._encodeBitString = exports.DER = exports.CER = exports.BER = void 0;
exports._decodeBigInt = exports._encodeBigInt = exports.ComponentSpec = exports._decodeAny = exports._decodeObjectDescriptor = exports._decodeUTCTime = exports._decodeGeneralizedTime = exports._decodeVisibleString = exports._decodeVideotexString = exports._decodeUTF8String = exports._decodeUniversalString = exports._decodeT61String = exports._decodeTeletexString = exports._decodePrintableString = exports._decodeNumericString = exports._decodeISO646String = exports._decodeIA5String = exports._decodeGraphicString = exports._decodeGeneralString = exports._decodeBMPString = exports._decodeTimeOfDay = exports._decodeTime = exports._decodeSet = exports._decodeSequence = exports._decodeRelativeOID = exports._decodeRelativeIRI = exports._decodeReal = exports._decodeOctetString = exports._decodeObjectIdentifier = exports._decodeNull = exports._decodeIRI = exports._decodeInteger = exports._decodeInstanceOf = exports._decodeExternal = void 0;
exports.hasTag = hasTag;
exports.hasAnyTag = hasAnyTag;
exports.hasTagClass = hasTagClass;
exports.hasTagNumberIn = hasTagNumberIn;
exports.and = and;
exports.or = or;
exports.not = not;
exports.tagClassName = tagClassName;
exports.deepEq = deepEq;
exports.isDefault = isDefault;
exports.present = present;
exports._encode_explicit = _encode_explicit;
exports._decode_explicit = _decode_explicit;
exports._encode_implicit = _encode_implicit;
exports._decode_implicit = _decode_implicit;
exports._tagClass = _tagClass;
exports._construction = _construction;
exports._tagNumber = _tagNumber;
exports._parse_set = _parse_set;
exports._parse_component_type_list = _parse_component_type_list;
exports._get_possible_initial_components = _get_possible_initial_components;
exports._parse_sequence_with_trailing_rctl = _parse_sequence_with_trailing_rctl;
exports._parse_sequence_without_trailing_rctl = _parse_sequence_without_trailing_rctl;
exports._parse_sequence = _parse_sequence;
exports._encode_choice = _encode_choice;
exports._decode_inextensible_choice = _decode_inextensible_choice;
exports._decode_extensible_choice = _decode_extensible_choice;
exports._decodeSequenceOf = _decodeSequenceOf;
exports._encodeSequenceOf = _encodeSequenceOf;
exports._decodeSetOf = _decodeSetOf;
exports._encodeSetOf = _encodeSetOf;
const index_1 = require("./index");
function hasTag(tagClass, tagNumber) {
    return function (index, elements) {
        const el = elements[index];
        return ((el.tagClass === tagClass) && (el.tagNumber === tagNumber));
    };
}
function hasAnyTag() {
    return true;
}
function hasTagClass(tagClass) {
    return function (index, elements) {
        return (elements[index].tagClass === tagClass);
    };
}
function hasTagNumberIn(tagNumbers) {
    return function (index, elements) {
        return tagNumbers.some((tn) => tn === elements[index].tagNumber);
    };
}
function and(...fns) {
    return function (index, elements) {
        return fns.every((fn) => fn(index, elements));
    };
}
function or(...fns) {
    return function (index, elements) {
        return fns.some((fn) => fn(index, elements));
    };
}
function not(fn) {
    return function (index, elements) {
        return !fn(index, elements);
    };
}
function tagClassName(tagClass) {
    switch (tagClass) {
        case (index_1.ASN1TagClass.universal): return "UNIVERSAL";
        case (index_1.ASN1TagClass.context): return "CONTEXT";
        case (index_1.ASN1TagClass.application): return "APPLICATION";
        case (index_1.ASN1TagClass.private): return "PRIVATE";
        default: {
            throw new Error(`Unrecognized ASN.1 Tag Class ${tagClass}.`);
        }
    }
}
function deepEq(value1, value2) {
    try {
        if (value1 === value2) {
            return true;
        }
        if (((typeof value1 === "bigint") || (typeof value1 === "number"))
            && ((typeof value2 === "bigint") || (typeof value2 === "number"))) {
            return (BigInt(value1) === BigInt(value2));
        }
        return (JSON.stringify(value1) === JSON.stringify(value2));
    }
    catch {
        return false;
    }
}
function isDefault(defaultValue) {
    return function (actualValue) {
        return deepEq(defaultValue, actualValue);
    };
}
function present(value) {
    return (value !== undefined);
}
function _encode_explicit(class_, tag, encoderGetter, outer) {
    return function (value, elGetter) {
        const ret = outer(value, outer);
        ret.sequence = [encoderGetter()(value, elGetter)];
        ret.construction = index_1.ASN1Construction.constructed;
        if (class_) {
            ret.tagClass = class_;
        }
        if (typeof tag !== "undefined") {
            ret.tagNumber = tag;
        }
        return ret;
    };
}
function _decode_explicit(decoderGetter) {
    return (el) => decoderGetter()(el.inner);
}
function _encode_implicit(class_, tag, encoderGetter, outer) {
    return function (value, elGetter) {
        const ret = encoderGetter()(value, elGetter);
        if (class_) {
            ret.tagClass = class_;
        }
        if (typeof tag !== "undefined") {
            ret.tagNumber = tag;
        }
        return ret;
    };
}
function _decode_implicit(decoderGetter) {
    return (el) => decoderGetter()(el);
}
function _tagClass(class_, encoderGetter) {
    const el = encoderGetter()();
    el.tagClass = class_;
    return el;
}
function _construction(con, encoderGetter) {
    const el = encoderGetter()();
    el.construction = con;
    return el;
}
function _tagNumber(tag, encoderGetter) {
    const el = encoderGetter()();
    el.tagNumber = tag;
    return el;
}
const BER = () => new index_1.BERElement();
exports.BER = BER;
const CER = () => new index_1.CERElement();
exports.CER = CER;
const DER = () => new index_1.DERElement();
exports.DER = DER;
const _encodeBitString = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.bitString = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.bitString;
    return el;
};
exports._encodeBitString = _encodeBitString;
const _encodeBoolean = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.boolean = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.boolean;
    return el;
};
exports._encodeBoolean = _encodeBoolean;
const _encodeUnrestrictedCharacterString = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.characterString = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.characterString;
    return el;
};
exports._encodeUnrestrictedCharacterString = _encodeUnrestrictedCharacterString;
const _encodeDate = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.date = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.date;
    return el;
};
exports._encodeDate = _encodeDate;
const _encodeDateTime = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.dateTime = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.dateTime;
    return el;
};
exports._encodeDateTime = _encodeDateTime;
const _encodeDuration = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.duration = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.duration;
    return el;
};
exports._encodeDuration = _encodeDuration;
const _encodeEmbeddedPDV = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.embeddedPDV = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.embeddedPDV;
    return el;
};
exports._encodeEmbeddedPDV = _encodeEmbeddedPDV;
const _encodeEnumerated = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.enumerated = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.enumerated;
    return el;
};
exports._encodeEnumerated = _encodeEnumerated;
const _encodeExternal = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.external = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.external;
    return el;
};
exports._encodeExternal = _encodeExternal;
const _encodeInstanceOf = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.external = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.external;
    return el;
};
exports._encodeInstanceOf = _encodeInstanceOf;
const _encodeInteger = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.integer = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.integer;
    return el;
};
exports._encodeInteger = _encodeInteger;
const _encodeIRI = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.oidIRI = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.oidIRI;
    return el;
};
exports._encodeIRI = _encodeIRI;
const _encodeNull = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.value = new Uint8Array(0);
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.nill;
    return el;
};
exports._encodeNull = _encodeNull;
const _encodeObjectIdentifier = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.objectIdentifier = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.objectIdentifier;
    return el;
};
exports._encodeObjectIdentifier = _encodeObjectIdentifier;
const _encodeOctetString = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.octetString = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.octetString;
    return el;
};
exports._encodeOctetString = _encodeOctetString;
const _encodeReal = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.real = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.realNumber;
    return el;
};
exports._encodeReal = _encodeReal;
const _encodeRelativeIRI = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.relativeOIDIRI = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.roidIRI;
    return el;
};
exports._encodeRelativeIRI = _encodeRelativeIRI;
const _encodeRelativeOID = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.relativeObjectIdentifier = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.relativeOID;
    return el;
};
exports._encodeRelativeOID = _encodeRelativeOID;
const _encodeSequence = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.sequence = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.sequence;
    return el;
};
exports._encodeSequence = _encodeSequence;
const _encodeSet = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.set = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.set;
    return el;
};
exports._encodeSet = _encodeSet;
const _encodeTime = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.time = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.time;
    return el;
};
exports._encodeTime = _encodeTime;
const _encodeTimeOfDay = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.timeOfDay = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.timeOfDay;
    return el;
};
exports._encodeTimeOfDay = _encodeTimeOfDay;
const _encodeBMPString = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.bmpString = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.bmpString;
    return el;
};
exports._encodeBMPString = _encodeBMPString;
const _encodeGeneralString = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.generalString = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.generalString;
    return el;
};
exports._encodeGeneralString = _encodeGeneralString;
const _encodeGraphicString = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.graphicString = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.graphicString;
    return el;
};
exports._encodeGraphicString = _encodeGraphicString;
const _encodeIA5String = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.ia5String = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.ia5String;
    return el;
};
exports._encodeIA5String = _encodeIA5String;
const _encodeISO646String = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.ia5String = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.ia5String;
    return el;
};
exports._encodeISO646String = _encodeISO646String;
const _encodeNumericString = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.numericString = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.numericString;
    return el;
};
exports._encodeNumericString = _encodeNumericString;
const _encodePrintableString = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.printableString = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.printableString;
    return el;
};
exports._encodePrintableString = _encodePrintableString;
const _encodeTeletexString = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.teletexString = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.teletexString;
    return el;
};
exports._encodeTeletexString = _encodeTeletexString;
const _encodeT61String = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.teletexString = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.teletexString;
    return el;
};
exports._encodeT61String = _encodeT61String;
const _encodeUniversalString = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.universalString = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.universalString;
    return el;
};
exports._encodeUniversalString = _encodeUniversalString;
const _encodeUTF8String = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.utf8String = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.utf8String;
    return el;
};
exports._encodeUTF8String = _encodeUTF8String;
const _encodeVideotexString = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.videotexString = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.videotexString;
    return el;
};
exports._encodeVideotexString = _encodeVideotexString;
const _encodeVisibleString = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.visibleString = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.visibleString;
    return el;
};
exports._encodeVisibleString = _encodeVisibleString;
const _encodeGeneralizedTime = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.generalizedTime = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.generalizedTime;
    return el;
};
exports._encodeGeneralizedTime = _encodeGeneralizedTime;
const _encodeUTCTime = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.utcTime = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.utcTime;
    return el;
};
exports._encodeUTCTime = _encodeUTCTime;
const _encodeObjectDescriptor = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.objectDescriptor = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.objectDescriptor;
    return el;
};
exports._encodeObjectDescriptor = _encodeObjectDescriptor;
const _encodeAny = (value) => {
    return value;
};
exports._encodeAny = _encodeAny;
const _decodeBitString = (el) => {
    return el.bitString;
};
exports._decodeBitString = _decodeBitString;
const _decodeBoolean = (el) => {
    return el.boolean;
};
exports._decodeBoolean = _decodeBoolean;
const _decodeUnrestrictedCharacterString = (el) => {
    return el.characterString;
};
exports._decodeUnrestrictedCharacterString = _decodeUnrestrictedCharacterString;
const _decodeDate = (el) => {
    return el.date;
};
exports._decodeDate = _decodeDate;
const _decodeDateTime = (el) => {
    return el.dateTime;
};
exports._decodeDateTime = _decodeDateTime;
const _decodeDuration = (el) => {
    return el.duration;
};
exports._decodeDuration = _decodeDuration;
const _decodeEmbeddedPDV = (el) => {
    return el.embeddedPDV;
};
exports._decodeEmbeddedPDV = _decodeEmbeddedPDV;
const _decodeEnumerated = (el) => {
    return el.enumerated;
};
exports._decodeEnumerated = _decodeEnumerated;
const _decodeExternal = (el) => {
    return el.external;
};
exports._decodeExternal = _decodeExternal;
const _decodeInstanceOf = (el) => {
    return el.external;
};
exports._decodeInstanceOf = _decodeInstanceOf;
const _decodeInteger = (el) => {
    return el.integer;
};
exports._decodeInteger = _decodeInteger;
const _decodeIRI = (el) => {
    return el.oidIRI;
};
exports._decodeIRI = _decodeIRI;
const _decodeNull = () => {
    return null;
};
exports._decodeNull = _decodeNull;
const _decodeObjectIdentifier = (el) => {
    return el.objectIdentifier;
};
exports._decodeObjectIdentifier = _decodeObjectIdentifier;
const _decodeOctetString = (el) => {
    return el.octetString;
};
exports._decodeOctetString = _decodeOctetString;
const _decodeReal = (el) => {
    return el.real;
};
exports._decodeReal = _decodeReal;
const _decodeRelativeIRI = (el) => {
    return el.relativeOIDIRI;
};
exports._decodeRelativeIRI = _decodeRelativeIRI;
const _decodeRelativeOID = (el) => {
    return el.relativeObjectIdentifier;
};
exports._decodeRelativeOID = _decodeRelativeOID;
const _decodeSequence = (el) => {
    return el.sequence;
};
exports._decodeSequence = _decodeSequence;
const _decodeSet = (el) => {
    return el.set;
};
exports._decodeSet = _decodeSet;
const _decodeTime = (el) => {
    return el.time;
};
exports._decodeTime = _decodeTime;
const _decodeTimeOfDay = (el) => {
    return el.timeOfDay;
};
exports._decodeTimeOfDay = _decodeTimeOfDay;
const _decodeBMPString = (el) => {
    return el.bmpString;
};
exports._decodeBMPString = _decodeBMPString;
const _decodeGeneralString = (el) => {
    return el.generalString;
};
exports._decodeGeneralString = _decodeGeneralString;
const _decodeGraphicString = (el) => {
    return el.graphicString;
};
exports._decodeGraphicString = _decodeGraphicString;
const _decodeIA5String = (el) => {
    return el.ia5String;
};
exports._decodeIA5String = _decodeIA5String;
const _decodeISO646String = (el) => {
    return el.ia5String;
};
exports._decodeISO646String = _decodeISO646String;
const _decodeNumericString = (el) => {
    return el.numericString;
};
exports._decodeNumericString = _decodeNumericString;
const _decodePrintableString = (el) => {
    return el.printableString;
};
exports._decodePrintableString = _decodePrintableString;
const _decodeTeletexString = (el) => {
    return el.teletexString;
};
exports._decodeTeletexString = _decodeTeletexString;
const _decodeT61String = (el) => {
    return el.teletexString;
};
exports._decodeT61String = _decodeT61String;
const _decodeUniversalString = (el) => {
    return el.universalString;
};
exports._decodeUniversalString = _decodeUniversalString;
const _decodeUTF8String = (el) => {
    return el.utf8String;
};
exports._decodeUTF8String = _decodeUTF8String;
const _decodeVideotexString = (el) => {
    return el.videotexString;
};
exports._decodeVideotexString = _decodeVideotexString;
const _decodeVisibleString = (el) => {
    return el.visibleString;
};
exports._decodeVisibleString = _decodeVisibleString;
const _decodeGeneralizedTime = (el) => {
    return el.generalizedTime;
};
exports._decodeGeneralizedTime = _decodeGeneralizedTime;
const _decodeUTCTime = (el) => {
    return el.utcTime;
};
exports._decodeUTCTime = _decodeUTCTime;
const _decodeObjectDescriptor = (el) => {
    return el.objectDescriptor;
};
exports._decodeObjectDescriptor = _decodeObjectDescriptor;
const _decodeAny = (el) => {
    return el;
};
exports._decodeAny = _decodeAny;
class ComponentSpec {
    constructor(name, optional, selector, groupIndex, versionNumber) {
        this.name = name;
        this.optional = optional;
        this.selector = selector;
        this.groupIndex = groupIndex;
        this.versionNumber = versionNumber;
    }
}
exports.ComponentSpec = ComponentSpec;
function _parse_set(set, decodingCallbacks, rootComponentTypeList1, extensionAdditionsList, rootComponentTypeList2, unrecognizedExtensionHandler = () => { }, maximumElements) {
    const rootComponents = rootComponentTypeList1.concat(rootComponentTypeList2);
    const components = rootComponents.concat(extensionAdditionsList);
    const elements = set.set;
    {
        const calculatedMaximumElements = (maximumElements === undefined)
            ? (components.length + 100)
            : maximumElements;
        if (elements.length > calculatedMaximumElements) {
            throw new Error(`SET '${set.name}' contained ${elements.length} elements, which exceeds the `
                + `limit of ${calculatedMaximumElements} permitted elements. This may be a result `
                + "of a Denial-of-Service (DoS) attack.");
        }
    }
    {
        const encounteredTags = new Set([]);
        for (const e of elements) {
            const tag = `${e.tagClass} ${e.tagNumber}`;
            if (encounteredTags.has(tag)) {
                throw new Error(`Duplicate tag '${tagClassName(e.tagClass)} ${e.tagNumber}' in SET '${set.name}'.`);
            }
            encounteredTags.add(tag);
        }
    }
    const encounteredComponents = new Set([]);
    const encounteredExtensionGroups = new Set([]);
    for (let i = 0; i < elements.length; i++) {
        const e = elements[i];
        const spec = components
            .find((cs) => cs.selector(i, elements));
        if (!spec) {
            unrecognizedExtensionHandler(e);
            continue;
        }
        if (encounteredComponents.has(spec.name)) {
            throw new Error(`SET '${set.name}' contained more than one '${spec.name}' component.`);
        }
        encounteredComponents.add(spec.name);
        if (spec.groupIndex !== undefined) {
            encounteredExtensionGroups.add(spec.groupIndex);
        }
        e.name = spec.name;
        if (spec.name in decodingCallbacks) {
            decodingCallbacks[spec.name](e, spec.name);
        }
        else {
            unrecognizedExtensionHandler(e);
        }
    }
    const missingRequiredComponents = rootComponents
        .filter((c) => (!c.optional && !encounteredComponents.has(c.name)))
        .map((c) => c.name);
    Array.from(encounteredExtensionGroups).forEach((exg) => {
        for (const c of extensionAdditionsList) {
            if (!((c.groupIndex === exg)
                && !c.optional
                && !encounteredComponents.has(c.name))) {
                continue;
            }
            missingRequiredComponents.push(c.name);
        }
    });
    if (missingRequiredComponents.length > 0) {
        throw new Error(`SET '${set.name}' missing these required components: ${missingRequiredComponents.join(", ")}.`);
    }
}
function _parse_component_type_list(componentTypeList, decodingCallbacks, elements, isExtensionAdditionsList) {
    let e = 0;
    let s = 0;
    let currentGroup = undefined;
    while (s < componentTypeList.length) {
        const element = elements[e];
        const spec = componentTypeList[s];
        if (!element) {
            if (spec.optional) {
                s++;
                continue;
            }
            else if (isExtensionAdditionsList) {
                if ((spec.groupIndex !== undefined) && (spec.groupIndex <= (currentGroup || Infinity))) {
                    throw new index_1.ASN1ConstructionError(`Missing required extension '${spec.name}' in SEQUENCE.`);
                }
                else {
                    s++;
                    continue;
                }
            }
            else {
                throw new index_1.ASN1ConstructionError(`Missing required component '${spec.name}' in SEQUENCE.`);
            }
        }
        if (spec.selector(e, elements)) {
            element.name = spec.name;
            if (spec.name in decodingCallbacks) {
                decodingCallbacks[spec.name](element, spec.name);
            }
            if (spec.groupIndex !== undefined) {
                currentGroup = spec.groupIndex;
            }
            e++;
        }
        else if (!spec.optional) {
            throw new Error(`Component '${spec.name}' missing from SEQUENCE.`);
        }
        s++;
    }
    return e;
}
function _get_possible_initial_components(componentTypeList) {
    let i = 0;
    while (i < componentTypeList.length) {
        if (!(componentTypeList[i++].optional)) {
            break;
        }
    }
    return componentTypeList.slice(0, i);
}
function _parse_sequence_with_trailing_rctl(seq, decodingCallbacks, rootComponentTypeList1, extensionAdditionsList, rootComponentTypeList2, unrecognizedExtensionHandler = () => { }) {
    const elements = seq.sequence;
    const startOfExtensions = _parse_component_type_list(rootComponentTypeList1, decodingCallbacks, elements, false);
    const possibleInitialRCTL2Components = _get_possible_initial_components(rootComponentTypeList2);
    const rctl2EntirelyOptional = rootComponentTypeList2.every((ct) => ct.optional);
    const extensionsOnwards = elements.slice(startOfExtensions);
    let numberOfExtensionElements = extensionsOnwards
        .findIndex((e, i) => possibleInitialRCTL2Components
        .some((pirctl2c) => pirctl2c.selector(i, extensionsOnwards)));
    if (numberOfExtensionElements === -1) {
        if (!rctl2EntirelyOptional) {
            throw new Error(`Trailing root component type list for SEQUENCE '${seq.name}' not found.`);
        }
        numberOfExtensionElements = elements.length - startOfExtensions;
    }
    const startOfRCTL2 = (startOfExtensions + numberOfExtensionElements);
    const numberOfExtensionsRead = _parse_component_type_list(extensionAdditionsList, decodingCallbacks, elements.slice(startOfExtensions, startOfRCTL2), true);
    const endOfRecognizedExtensions = (startOfExtensions + numberOfExtensionsRead);
    elements
        .slice(endOfRecognizedExtensions, startOfRCTL2)
        .forEach((x) => unrecognizedExtensionHandler(x));
    const numberOfRCTL2ElementsRead = _parse_component_type_list(rootComponentTypeList2, decodingCallbacks, elements.slice(startOfRCTL2), false);
    if (startOfRCTL2 + numberOfRCTL2ElementsRead !== elements.length) {
        throw new Error(`SEQUENCE '${seq.name}' had excess elements at the end.`);
    }
}
function _parse_sequence_without_trailing_rctl(seq, decodingCallbacks, rootComponentTypeList1, extensionAdditionsList, unrecognizedExtensionHandler = () => { }) {
    const elements = seq.sequence;
    const startOfExtensions = _parse_component_type_list(rootComponentTypeList1, decodingCallbacks, elements, false);
    const numberOfExtensionsRead = _parse_component_type_list(extensionAdditionsList, decodingCallbacks, elements.slice(startOfExtensions), true);
    const endOfRecognizedExtensions = (startOfExtensions + numberOfExtensionsRead);
    elements
        .slice(endOfRecognizedExtensions)
        .forEach((x) => unrecognizedExtensionHandler(x));
}
function _parse_sequence(seq, decodingCallbacks, rootComponentTypeList1, extensionAdditionsList, rootComponentTypeList2, unrecognizedExtensionHandler = () => { }) {
    if (rootComponentTypeList2.length > 0) {
        _parse_sequence_with_trailing_rctl(seq, decodingCallbacks, rootComponentTypeList1, extensionAdditionsList, rootComponentTypeList2, unrecognizedExtensionHandler);
    }
    else {
        _parse_sequence_without_trailing_rctl(seq, decodingCallbacks, rootComponentTypeList1, extensionAdditionsList, unrecognizedExtensionHandler);
    }
}
function _encode_choice(choices, elGetter) {
    return function (value) {
        if (value instanceof index_1.ASN1Element) {
            return value;
        }
        const key = Object.keys(value)[0];
        if (!key) {
            throw new Error("Empty choice value object.");
        }
        const encoder = choices[key];
        if (!encoder) {
            throw new Error(`Unrecognized alternative '${String(key)}'.`);
        }
        return encoder(value[key], elGetter);
    };
}
function _decode_inextensible_choice(choices) {
    return function (el) {
        const result = choices[`${tagClassName(el.tagClass)} ${el.tagNumber}`];
        if (!result) {
            if (choices["*"]) {
                const ret = {};
                ret[choices["*"][0]] = choices["*"][1](el);
                return ret;
            }
            else {
                throw new Error(`Unrecognized CHOICE tag '${tagClassName(el.tagClass)} ${el.tagNumber}'.`);
            }
        }
        const [name, decoder] = result;
        const ret = {};
        ret[name] = decoder(el);
        return ret;
    };
}
function _decode_extensible_choice(choices) {
    return function (el) {
        const result = choices[`${tagClassName(el.tagClass)} ${el.tagNumber}`];
        if (!result) {
            return el;
        }
        const [name, decoder] = result;
        const ret = {};
        ret[name] = decoder(el);
        return ret;
    };
}
function _decodeSequenceOf(decoderGetter) {
    return function (el) {
        return el.sequence.map(decoderGetter());
    };
}
function _encodeSequenceOf(encoderGetter, outerElGetter) {
    return function (value) {
        const el = outerElGetter(value, outerElGetter);
        const encoder = encoderGetter();
        el.sequence = value.map((v) => encoder(v, outerElGetter));
        el.tagClass = index_1.ASN1TagClass.universal;
        el.tagNumber = index_1.ASN1UniversalType.sequence;
        return el;
    };
}
function _decodeSetOf(decoderGetter) {
    return function (el) {
        return el.setOf.map(decoderGetter());
    };
}
function _encodeSetOf(encoderGetter, outerElGetter) {
    return function (value) {
        const el = outerElGetter(value, outerElGetter);
        const encoder = encoderGetter();
        el.setOf = value.map((v) => encoder(v, outerElGetter));
        el.tagClass = index_1.ASN1TagClass.universal;
        el.tagNumber = index_1.ASN1UniversalType.set;
        return el;
    };
}
const _encodeBigInt = (value, elGetter) => {
    const el = elGetter(value, elGetter);
    el.octetString = value;
    el.tagClass = index_1.ASN1TagClass.universal;
    el.tagNumber = index_1.ASN1UniversalType.integer;
    return el;
};
exports._encodeBigInt = _encodeBigInt;
const _decodeBigInt = (el) => {
    return el.octetString;
};
exports._decodeBigInt = _decodeBigInt;
