import type { INTEGER } from "../macros";
import { Buffer } from "node:buffer";
export declare function bufferToInteger(input: Buffer | Uint8Array): INTEGER;
export declare function integerToBuffer(int: INTEGER): Buffer;
