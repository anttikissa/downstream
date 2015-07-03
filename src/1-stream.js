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
    // state is one of 'active', 'ended', or 'error'
    this.state = 'active';

    this.parents.forEach(parent => {
        if (!(parent instanceof Stream)) {
            throw new Error('parent ' + parent + ' is not a Stream');
        }
        parent.addChild(this);
    });

    extend(this, options);

    function hasValue(parent) {
        return parent.hasValue();
    }

    // Handle the initial value: if some of my parents had a value, then run
    // the update function to potentially give this stream a value, too.
    if (this.parents.some(hasValue)) {
        this.update.apply(this, this.parents);
    }

    // Calling update above has set `this.version` to `stream.version`. But to
    // be really pitch-perfect, `this.version` should be as if this stream had
    // existed when its parents last updated. This is a fine nuance really
    // (perhaps unnecessarily fine), and only matters when giving related
    // streams to operators that deeply care about their parents' initial
    // versions (such as `Stream.merge`).

    this.version = Math.max(...this.parents.map(parent => parent.version));
}

// Stream::hasValue() -> boolean
//
// Does this stream have a value?
Stream.prototype.hasValue = function() {
    return typeof this.value !== 'undefined';
};

// Stream::hasEnded() -> boolean
//
// Has this stream ended?
Stream.prototype.hasEnded = function() {
    return this.state === 'ended';
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
