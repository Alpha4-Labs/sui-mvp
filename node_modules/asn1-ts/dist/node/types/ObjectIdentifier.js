"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const decodeObjectIdentifier_1 = __importDefault(require("../codecs/x690/decoders/decodeObjectIdentifier"));
const encodeObjectIdentifier_1 = __importDefault(require("../codecs/x690/encoders/encodeObjectIdentifier"));
const PERIOD = ".".charCodeAt(0);
class ObjectIdentifier {
    constructor(nodes, prefix) {
        const _nodes = prefix
            ? typeof prefix === "number"
                ? [prefix, ...nodes]
                : [...prefix.nodes, ...nodes]
            : nodes.slice(0);
        if (_nodes.length < 2) {
            throw new Error("Cannot construct an OID with less than two nodes!");
        }
        if ((_nodes[0] < 0) || (_nodes[0] > 2)) {
            throw new Error("OIDs first node must be 0, 1, or 2!");
        }
        if (((_nodes[0] < 2) && (_nodes[1] > 39)) || (_nodes[1] > 175)) {
            throw new Error("OID Node #2 cannot exceed 39 if node #1 is 0 or 1, and 175 "
                + `if node #1 is 2. Received these nodes: ${_nodes}.`);
        }
        this._nodes = new Uint32Array(_nodes);
    }
    get uint32ArrayRef() {
        return this._nodes;
    }
    get nodes() {
        return Array.from(this._nodes);
    }
    get dotDelimitedNotation() {
        return this._nodes.join(".");
    }
    get asn1Notation() {
        return `{ ${Array.from(this._nodes).map((node) => node.toString()).join(" ")} }`;
    }
    toString() {
        return this.dotDelimitedNotation;
    }
    toJSON() {
        return this.dotDelimitedNotation;
    }
    toBytes() {
        return (0, encodeObjectIdentifier_1.default)(this);
    }
    static fromString(str) {
        const arcs = [];
        let last = 0;
        let i = 0;
        while (i < str.length) {
            if (str.charCodeAt(i) === PERIOD) {
                const arc = Number.parseInt(str.slice(last, i), 10);
                arcs.push(arc);
                last = i + 1;
            }
            i++;
        }
        const arc = Number.parseInt(str.slice(last, i), 10);
        arcs.push(arc);
        return new ObjectIdentifier(arcs);
    }
    static fromBytes(bytes) {
        return (0, decodeObjectIdentifier_1.default)(bytes);
    }
    static compare(a, b) {
        if (a._nodes.length !== b._nodes.length) {
            return false;
        }
        const len = a._nodes.length;
        let i = len - 1;
        while (i >= 0) {
            if (a._nodes[i] !== b._nodes[i]) {
                return false;
            }
            i--;
        }
        return true;
    }
    isEqualTo(other) {
        return ObjectIdentifier.compare(this, other);
    }
}
exports.default = ObjectIdentifier;
