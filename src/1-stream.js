//
// 1-stream.js
//
// This file contains the constructor new Stream(), and the equivalent function
// stream(), along with some debugging tools.
//

// Create a stream.
//
// new Stream(
//  optional Stream parent | Stream[] parents,
//  optional object options) -> Stream
function Stream(parentOrParents, options) {
    // Handle the first argument that can be undefined, Stream or Stream[].
    if (parentOrParents) {
        this.parents = isArray(parentOrParents)
            ? parentOrParents
            : [parentOrParents];
    } else {
        this.parents = [];
    }

    this.children = [];
    this.listeners = [];
    this.version = 0;

    this.parents.forEach(function(parent) {
        if (!(parent instanceof Stream)) {
            throw new Error('parent ' + parent + ' is not a Stream');
        }
        parent.addChild(this);
    }, this);

    extend(this, options);

    function hasValue(parent) {
        return parent.hasValue();
    }

    // Handle the initial value: if some of my parents had a value, then run
    // the update function to potentially give this stream a value, too.
    if (this.parents.some(hasValue)) {
        this.update.apply(this, this.parents);
    }
}

// Stream::hasValue() -> boolean
//
// Does this stream have a value?
Stream.prototype.hasValue = function() {
    return typeof this.value !== 'undefined';
};

// Stream::addChild(Stream child)
//
// Register `child` as my child
Stream.prototype.addChild = function(child) {
    this.children.push(child);
};

// It's an error if a stream that doesn't have an `update` function gets
// updated; the default implementation ensures that you get this message instead
// of "Cannot read property 'apply' of undefined" or equivalent
//
Stream.prototype.update = function() {
    throw new Error('Stream does not define update()');
};

// Shorthand to new Stream(...), and a namespace to the many utility functions
// and operators that come with Downstream: combine, from, fromDomEvent, etc.
function stream(parentOrParents, options) {
    return new Stream(parentOrParents, options);
}

// Stream::log(optional string prefix)
//
// For every value of `this`, print the value using `console.log`.
// If `prefix` is given, use that as the first argument to `console.log`.
Stream.prototype.log = function(prefix) {
    if (prefix) {
        this.forEach(function(value) {
            console.log(prefix, value);
        });
    } else {
        this.forEach(function(value) {
            console.log(value);
        });
    }
};
