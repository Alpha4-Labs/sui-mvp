import { INTEGER } from "../../macros";
export default class HOURS_MINUTES_DIFF_ENCODING {
    readonly hours: INTEGER;
    readonly minutes: INTEGER;
    readonly minutes_diff: INTEGER;
    constructor(hours: INTEGER, minutes: INTEGER, minutes_diff: INTEGER);
}
