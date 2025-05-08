"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = encodeExternal;
const der_1 = __importDefault(require("../../../codecs/der"));
const values_1 = require("../../../values");
const asn1_1 = __importDefault(require("../../../asn1"));
function encodeExternal(value) {
    let directReferenceElement = undefined;
    if (value.directReference) {
        directReferenceElement = new der_1.default(values_1.ASN1TagClass.universal, values_1.ASN1Construction.primitive, values_1.ASN1UniversalType.objectIdentifier, value.directReference);
    }
    let indirectReferenceElement = undefined;
    if (value.indirectReference) {
        indirectReferenceElement = new der_1.default(values_1.ASN1TagClass.universal, values_1.ASN1Construction.primitive, values_1.ASN1UniversalType.integer, value.indirectReference);
    }
    let dataValueDescriptorElement = undefined;
    if (value.dataValueDescriptor) {
        dataValueDescriptorElement = new der_1.default(values_1.ASN1TagClass.universal, values_1.ASN1Construction.primitive, values_1.ASN1UniversalType.objectDescriptor);
        dataValueDescriptorElement.objectDescriptor = value.dataValueDescriptor;
    }
    let encodingElement = undefined;
    if (value.encoding instanceof asn1_1.default) {
        encodingElement = new der_1.default(values_1.ASN1TagClass.context, values_1.ASN1Construction.constructed, 0, value.encoding);
    }
    else if (value.encoding instanceof Uint8Array) {
        encodingElement = new der_1.default(values_1.ASN1TagClass.context, values_1.ASN1Construction.primitive, 1, value.encoding);
    }
    else {
        encodingElement = new der_1.default(values_1.ASN1TagClass.context, values_1.ASN1Construction.primitive, 2);
        encodingElement.bitString = value.encoding;
    }
    const ret = der_1.default.fromSequence([
        directReferenceElement,
        indirectReferenceElement,
        dataValueDescriptorElement,
        encodingElement,
    ]);
    return ret.value;
}
