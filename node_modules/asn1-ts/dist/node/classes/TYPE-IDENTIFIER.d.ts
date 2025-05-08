import { ASN1Decoder, ASN1Encoder } from "../functional";
import type { OBJECT_IDENTIFIER } from "../macros";
export default interface TYPE_IDENTIFIER<Type = any> {
    class: string;
    decoderFor: Partial<{
        [_K in keyof TYPE_IDENTIFIER<Type>]: ASN1Decoder<TYPE_IDENTIFIER<Type>[_K]>;
    }>;
    encoderFor: Partial<{
        [_K in keyof TYPE_IDENTIFIER<Type>]: ASN1Encoder<TYPE_IDENTIFIER<Type>[_K]>;
    }>;
    "&id": OBJECT_IDENTIFIER;
    "&Type": Type;
}
