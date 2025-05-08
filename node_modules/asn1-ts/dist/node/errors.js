"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASN1ConstructionError = exports.ASN1CharactersError = exports.ASN1UndefinedError = exports.ASN1PaddingError = exports.ASN1SizeError = exports.ASN1OverflowError = exports.ASN1TruncationError = exports.ASN1RecursionError = exports.ASN1NotImplementedError = exports.ASN1Error = void 0;
class ASN1Error extends Error {
    constructor(m, element) {
        super(m);
        this.m = m;
        this.element = element;
        Object.setPrototypeOf(this, ASN1Error.prototype);
    }
}
exports.ASN1Error = ASN1Error;
class ASN1NotImplementedError extends ASN1Error {
    constructor() {
        super("Not yet implemented.");
        Object.setPrototypeOf(this, ASN1NotImplementedError.prototype);
    }
}
exports.ASN1NotImplementedError = ASN1NotImplementedError;
class ASN1RecursionError extends ASN1Error {
    constructor() {
        super("Recursion was too deep.");
        Object.setPrototypeOf(this, ASN1RecursionError.prototype);
    }
}
exports.ASN1RecursionError = ASN1RecursionError;
class ASN1TruncationError extends ASN1Error {
    constructor(m, element) {
        super(m, element);
        this.m = m;
        this.element = element;
        Object.setPrototypeOf(this, ASN1TruncationError.prototype);
    }
}
exports.ASN1TruncationError = ASN1TruncationError;
class ASN1OverflowError extends ASN1Error {
    constructor(m, element) {
        super(m, element);
        this.m = m;
        this.element = element;
        Object.setPrototypeOf(this, ASN1OverflowError.prototype);
    }
}
exports.ASN1OverflowError = ASN1OverflowError;
class ASN1SizeError extends ASN1Error {
    constructor(m, element) {
        super(m, element);
        this.m = m;
        this.element = element;
        Object.setPrototypeOf(this, ASN1SizeError.prototype);
    }
}
exports.ASN1SizeError = ASN1SizeError;
class ASN1PaddingError extends ASN1Error {
    constructor(m, element) {
        super(m, element);
        this.m = m;
        this.element = element;
        Object.setPrototypeOf(this, ASN1PaddingError.prototype);
    }
}
exports.ASN1PaddingError = ASN1PaddingError;
class ASN1UndefinedError extends ASN1Error {
    constructor(m, element) {
        super(m, element);
        this.m = m;
        this.element = element;
        Object.setPrototypeOf(this, ASN1UndefinedError.prototype);
    }
}
exports.ASN1UndefinedError = ASN1UndefinedError;
class ASN1CharactersError extends ASN1Error {
    constructor(m, element) {
        super(m, element);
        this.m = m;
        this.element = element;
        Object.setPrototypeOf(this, ASN1CharactersError.prototype);
    }
}
exports.ASN1CharactersError = ASN1CharactersError;
class ASN1ConstructionError extends ASN1Error {
    constructor(m, element) {
        super(m, element);
        this.m = m;
        this.element = element;
        Object.setPrototypeOf(this, ASN1ConstructionError.prototype);
    }
}
exports.ASN1ConstructionError = ASN1ConstructionError;
