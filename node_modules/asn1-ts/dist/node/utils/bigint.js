"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bufferToInteger = bufferToInteger;
exports.integerToBuffer = integerToBuffer;
const values_1 = require("../values");
const node_buffer_1 = require("node:buffer");
function bufferToInteger(input) {
    const buf = (input instanceof node_buffer_1.Buffer)
        ? input
        : node_buffer_1.Buffer.from(input.buffer);
    switch (buf.length) {
        case (0): return 0;
        case (1): return buf.readInt8();
        case (2): return buf.readInt16BE();
        case (4): return buf.readInt32BE();
        case (8): return buf.readBigInt64BE();
        default: {
            if (buf[0] & 0x80) {
                return BigInt.asIntN((buf.length * 8), BigInt(`0x${buf.toString("hex")}`));
            }
            else {
                return BigInt(`0x${buf.toString("hex")}`);
            }
        }
    }
}
function integerToBuffer(int) {
    if (typeof int === "number") {
        if ((int <= 127) && (int >= -128)) {
            const buf = node_buffer_1.Buffer.allocUnsafe(1);
            buf.writeInt8(int);
            return buf;
        }
        else if ((int <= 32767) && (int >= -32768)) {
            const buf = node_buffer_1.Buffer.allocUnsafe(2);
            buf.writeInt16BE(int);
            return buf;
        }
        else if ((int <= 8388607) && (int >= -8388608)) {
            const buf = node_buffer_1.Buffer.allocUnsafe(4);
            buf.writeInt32BE(int);
            return buf.subarray(1);
        }
        else if ((int >= values_1.MIN_SINT_32) && (int <= values_1.MAX_SINT_32)) {
            const buf = node_buffer_1.Buffer.allocUnsafe(4);
            buf.writeInt32BE(int);
            return buf;
        }
        else {
            const ret = node_buffer_1.Buffer.allocUnsafe(8);
            ret.writeBigInt64BE(BigInt(int));
            let startOfNonPadding = 0;
            if (int >= 0) {
                for (let i = 0; i < (ret.length - 1); i++) {
                    if (ret[i] !== 0x00) {
                        break;
                    }
                    if (!(ret[i + 1] & 0x80)) {
                        startOfNonPadding++;
                    }
                }
            }
            else {
                for (let i = 0; i < (ret.length - 1); i++) {
                    if (ret[i] !== 0xFF) {
                        break;
                    }
                    if (ret[i + 1] & 0x80) {
                        startOfNonPadding++;
                    }
                }
            }
            return ret.subarray(startOfNonPadding);
        }
    }
    else {
        let startOfNonPadding = 0;
        let ret = node_buffer_1.Buffer.allocUnsafe(8);
        if ((int >= Number.MIN_SAFE_INTEGER)
            && (int <= Number.MAX_SAFE_INTEGER)) {
            ret.writeBigInt64BE(int);
        }
        else if (int >= 0) {
            const hex = int.toString(16);
            ret = node_buffer_1.Buffer.from(((hex.length % 2) ? `0${hex}` : hex), "hex");
            if (ret[0] & 128) {
                ret = node_buffer_1.Buffer.concat([
                    node_buffer_1.Buffer.from([0x00]),
                    ret,
                ]);
            }
        }
        else {
            const hex = BigInt.asUintN(100000000, int).toString(16);
            ret = node_buffer_1.Buffer.from(((hex.length % 2) ? `0${hex}` : hex), "hex");
            if (!(ret[0] & 128)) {
                ret = node_buffer_1.Buffer.concat([
                    node_buffer_1.Buffer.from([0xFF]),
                    ret,
                ]);
            }
        }
        if (int >= 0) {
            for (let i = 0; i < (ret.length - 1); i++) {
                if (ret[i] !== 0x00) {
                    break;
                }
                if (!(ret[i + 1] & 0x80)) {
                    startOfNonPadding++;
                }
            }
        }
        else {
            for (let i = 0; i < (ret.length - 1); i++) {
                if (ret[i] !== 0xFF) {
                    break;
                }
                if (ret[i + 1] & 0x80) {
                    startOfNonPadding++;
                }
            }
        }
        return ret.subarray(startOfNonPadding);
    }
}
