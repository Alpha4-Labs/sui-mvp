import type ASN1Element from "../asn1";
export default interface Enelementable {
    toElement(): ASN1Element;
}
