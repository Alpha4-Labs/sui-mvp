import BERElement from "../../ber";
import { SEQUENCE } from "../../../macros";
export default function decodeSequence(value: Uint8Array): SEQUENCE<BERElement>;
