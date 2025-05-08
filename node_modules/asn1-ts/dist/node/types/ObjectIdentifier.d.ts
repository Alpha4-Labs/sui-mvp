import type { Buffer } from "node:buffer";
export default class ObjectIdentifier {
    private _nodes;
    constructor(nodes: number[], prefix?: ObjectIdentifier | number);
    get uint32ArrayRef(): Uint32Array;
    get nodes(): number[];
    get dotDelimitedNotation(): string;
    get asn1Notation(): string;
    toString(): string;
    toJSON(): string;
    toBytes(): Buffer;
    static fromString(str: string): ObjectIdentifier;
    static fromBytes(bytes: Uint8Array): ObjectIdentifier;
    static compare(a: ObjectIdentifier, b: ObjectIdentifier): boolean;
    isEqualTo(other: ObjectIdentifier): boolean;
}
