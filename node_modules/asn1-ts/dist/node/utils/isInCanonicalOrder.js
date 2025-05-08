"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = isInCanonicalOrder;
const values_1 = require("../values");
function isInCanonicalOrder(elements) {
    let previousTagClass = null;
    let previousTagNumber = null;
    return (elements.every((element) => {
        if (previousTagClass !== null
            && element.tagClass !== previousTagClass
            && values_1.CANONICAL_TAG_CLASS_ORDERING.indexOf(element.tagClass)
                <= values_1.CANONICAL_TAG_CLASS_ORDERING.indexOf(previousTagClass))
            return false;
        if (element.tagClass !== previousTagClass)
            previousTagNumber = null;
        if (previousTagNumber !== null && element.tagNumber < previousTagNumber)
            return false;
        previousTagClass = element.tagClass;
        previousTagNumber = element.tagNumber;
        return true;
    }));
}
