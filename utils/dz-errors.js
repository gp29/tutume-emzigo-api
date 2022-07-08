'use strict';
const _ = require('underscore');

function DZError(message, code, name = 'DZError') {
    this.name = name;
    this.message = message || 'Default Message';
    this.code = code;
    this.stack = (new Error()).stack;
}

DZError.prototype = Object.create(Error.prototype);
DZError.prototype.constructor = DZError;

module.exports = function(...args) {
    const error = new DZError(
        args[0],
        args[1],
    );
    return _.omit(error, 'stack');
};