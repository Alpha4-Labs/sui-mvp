import { BIT_STRING, INTEGER, OBJECT_IDENTIFIER, OCTET_STRING, ObjectDescriptor } from "../macros";
import type ASN1Element from "../asn1";
export default class External {
    readonly directReference: OBJECT_IDENTIFIER | undefined;
    readonly indirectReference: INTEGER | undefined;
    readonly dataValueDescriptor: ObjectDescriptor | undefined;
    readonly encoding: ASN1Element | OCTET_STRING | BIT_STRING;
    constructor(directReference: OBJECT_IDENTIFIER | undefined, indirectReference: INTEGER | undefined, dataValueDescriptor: ObjectDescriptor | undefined, encoding: ASN1Element | OCTET_STRING | BIT_STRING);
    toString(): string;
    toJSON(): unknown;
}
