import CERElement from "../../cer";
import { SEQUENCE } from "../../../macros";
export default function decodeSequence(value: Uint8Array): SEQUENCE<CERElement>;
