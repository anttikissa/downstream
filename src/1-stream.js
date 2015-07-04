//
// 1-stream.js
//
// This file contains the constructor new Stream(), and the equivalent function
// stream(), along with some debugging tools.
//

// Create a stream.
//
// There are two different ways to create stream:
//
// new Stream() -> Stream                      // create a source stream
//
// new Stream(
//  optional Stream parent | Stream[] parents,
//  optional object options) -> Stream         // create a derived stream
//
// The first form creates a *source stream*: a stream that you can use as a
// parent for derived streams, and whose value you can update with `.set()`.
//
// The second form creates a *derived stream*: a stream that can react to its
// parents' updates by having its `.update()` method called.
//
// You can listen to changes in both kinds of streams; the difference is that
// calling '.set()' is allowed only for source streams, and defining `.update()`
// is only allowed for derived streams. In practice, the presence of `.update()`
// determines the stream.
//
// The constructor creates parent-child links between its parents and the newly
// created stream, initializes itself, extends itself with `options`, and
// finally establishes the initial value.
function Stream(parentOrParents = [], options = {}) {
    // This lets you use both `[parent1, parent2, ...]` and `parent`
    this.parents = [].concat(parentOrParents);

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

    this.version = 0;

    extend(this, options);

    // Establish the initial value: if some of my parents had a value, then run
    // the update function to potentially give this stream a value, too.
    if (this.parents.some(parent => parent.hasValue())) {
        this.update(...this.parents);

        // If the update call above did set a value, it also set `this.version`
        // to `stream.version`, which is nonzero.
        if (this.version > 0) {
            // But what we actually want for `this.version` is the version of
            // the most recently updated parent, as if this stream had been
            // around when it updated. This is a fine nuance really (perhaps
            // unnecessarily fine), and only matters when giving related streams
            // to operators that care about their parents' initial versions
            // (such as `Stream.merge`).
            this.version = Math.max(...this.parents.map(parent => parent.version));
        }
    }
}

// Stream::hasValue() -> boolean
//
// Does this stream have a value?
Stream.prototype.hasValue = function() {
    return this.value !== undefined;
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
