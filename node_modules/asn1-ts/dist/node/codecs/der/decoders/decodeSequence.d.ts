import DERElement from "../../der";
import { SEQUENCE } from "../../../macros";
export default function decodeSequence(value: Uint8Array): SEQUENCE<DERElement>;
