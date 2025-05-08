import type ASN1Element from "../asn1";
export default interface Deelementable {
    fromElement(el: ASN1Element): void;
}
