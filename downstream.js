// Copy all attributes from 'sources' to 'target'.
function extend(target /*, ...sources */) {
    for (var i = 1; i < arguments.length; i++) {
        if (arguments[i]) {
            for (var key in arguments[i]) {
                target[key] = arguments[i][key];
            }
        }
    }
}

// isArray(Object object)
//
// Is `object` an array?
function isArray(object) {
	return Array.isArray(object);
}

// defer(Function f)
//
// Call 'f' a bit later.
var defer = typeof setImmediate === 'function' ? setImmediate : setTimeout;
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
//
// 2-stream-set.js
//
// This file contains the method `set()`, and the machinery that is uses to make
// streams tick.
//

// An increasing number that is incremented every time `Stream::set()` is
// called.
//
// All streams that are updated as result will get their `.version` bumped to
// the new value.
//
// `Stream::wasUpdated()` uses the version to determine if stream was
// changed during this tick.
stream.version = 0;

// Stream::wasUpdated() -> boolean
//
// Was stream updated since the start of the most recent tick?
//
// Typically used by update functions that need to know which parent caused the
// update.
Stream.prototype.wasUpdated = function() {
    return this.version === stream.version;
};

// Stream::newValue(value)
//
// Update stream's value to `value` and set its `.version` to `stream.version`.
// This marks the stream as updated during this tick.
//
// Update functions should use this to set the new value.
Stream.prototype.newValue = function(value) {
    this.value = value;
    this.version = stream.version;
};

// Stream::set(value) -> Stream
//
// Set the value of this stream to `value`.
//
// Transitively update all streams that depend on this streams. After a stream's
// value has been updated, call its `forEach` listeners with the new value.
//
// Return `this` so you can do things like `s.set(1).forEach(f)`.
Stream.prototype.set = function(value) {
    stream.version++;

    // Start by updating my value.
    this.newValue(value);

    var streamsToUpdate = stream.updateOrder(this);

    function wasUpdated(parent) {
        return parent.wasUpdated();
    }

    // `streamsToUpdate` now contains the streams that potentially need to be
    // updated.
    for (var i = 0, length = streamsToUpdate.length; i < length; i++) {
        var s = streamsToUpdate[i];

        // Update the stream only if at least one of its parents was updated.
        // The ordering of `streamsToUpdate` guarantees that all of `s.parents`
        // that might have changed during this tick have been updated now.
        if (s.parents.some(wasUpdated)) {
            s.update.apply(s, s.parents);
        }

        s.listeners.forEach(function(listener) {
            if (s.wasUpdated()) {
                listener(s.value);
            }
        });
    }

    return this;
};

// Stream::updateOrder(Stream source) -> Stream[]
//
// Given that we're about to set the value of `source`, which streams should we
// consider updating and in which order?
//
// Returns a topological ordering of streams reachable from `source` through
// parent-child relationships.
//
//  var s = stream();
//  var s2 = s.map(function(x) { return x + 1; });
//  var s3 = s.map(function(x) { return x + 1; });
//  var s4 = stream.combine(s2, s3, function(x, y) { return x + y; });
//
//  updateOrder(s) => [s, s2, s3, s4]
//
// Internally used by stream.set().
stream.updateOrder = function(source) {
    // First do a depth-first traversal of nodes.
    var dfsTraversalOrder = [];

    function dfs(node) {
        dfsTraversalOrder.push(node);
        node.children.forEach(dfs);
    }

    dfs(source);

    // The result looks like (in our example case):
    //
    //  dfsTraversalOrder = [1, 2, 4, 3, 4]
    //
    // from which we want to pick only the last occurrence of each node:
    //
    //  result =            [1, 2,    3, 4]

    // To that end, a loop with a simple check shall do.
    //
    // TODO This looks like O(n^2), but let's optimize when it starts to matter.
    function isLastIndexOf(node, idx) {
        return dfsTraversalOrder.lastIndexOf(node) === idx;
    }

    var result = [];
    dfsTraversalOrder.forEach(function(node, idx) {
        if (isLastIndexOf(node, idx)) {
            result.push(node);
        }
    });

    return result;
};
//
// 3-stream-listeners.js
//
// This file is about listeners: adding and removing them from streams.
// `Stream::forEach()` is the primary way to add listeners. Internally, it calls
// `Stream::addListener()`, and you can call `Stream::removeListener` to remove
// the link to the listener.
//
// Eventually, there will be possibility to listen to errors and ends in
// addition to values. Wait and see.
//
// In general, the following rules apply to all listeners:
//
// - Trying to remove a listener that hasn't been added is a no-op.
// - You can add the same listener more than once.
// - In that case, you must remove the listener as many times as you
//

// Stream::forEach(Function f) -> Stream
//
// Arrange for `f(value)` to be called for the current value (if one exists) and
// all eventual values of the stream.
//
// If the stream already has a value, `f` will be called immediately with the
// current value.
//
// Returns the stream itself.
Stream.prototype.forEach = function(f) {
    if (this.hasValue()) {
        f(this.value);
    }

    this.addListener(f);

    return this;
};

// Add `f` to `this.listeners`.
Stream.prototype.addListener = function(f) {
    this.listeners.push(f);
};

// Remove the first instance of `f` from `this.listeners`, if it is there.
Stream.prototype.removeListener = function(f) {
    var idx = this.listeners.indexOf(f);
    if (idx !== -1) {
        this.listeners.splice(idx, 1);
    }
};
//
// 4-stream-listeners.js
//
// This file defines operators - building blocks that you can use to combine
// streams into complex structures.
//
// Some of the operators naturally take one argument and are placed into
// `Stream.prototype` as methods of all stream objects. These include `map`,
// `filter`, `uniq`, `reduce`, `flatMap`, etc.
//
// Other operators take `0`-`n` streams and feel more at home as standalone
// functions in the `stream` namespace. These include `combine`, `merge`, etc.
//

// Stream::map(Function f) -> Stream
//
// Create a stream that updates with `f(x)` when this stream updates with `x`.
//
// var s2 = s1.map(function(value) { return value + 1; });
//
// s1: 1 1 2 2 5 6 6
// s2: 2 2 3 3 6 7 7
Stream.prototype.map = function(f) {
    function mapUpdate(parent) {
        this.newValue(this.f(parent.value));
    }

    return stream(this, { update: mapUpdate, f: f });
};

// Stream::filter(Function f) -> Stream
//
// Create a stream that updates with `x` when this stream updates with `x` and
// `f(x)` is true.
//
// var s2 = s1.filter(function(n) { return n % 2; });
//
// s1: 1 1 2 2 5 6 6
// s2: 1 1     5
Stream.prototype.filter = function(f) {
    function filterUpdate(parent) {
        if (this.f(parent.value)) {
            this.newValue(parent.value);
        }
    }

    return stream(this, { update: filterUpdate, f: f });
};

// Stream::uniq() -> Stream
//
// Create a stream that updates when its parent updates but only when the value
// changes (like the UNIX tool `uniq(1)``).
//
// The equality check used is `===`, so you might not get the expected result if
// your stream gives `NaN` values (because `NaN !== NaN`).
//
// var s2 = s1.uniq();
//
// s1: 1 1 2 2 5 6 6
// s2: 1   2   5 6
Stream.prototype.uniq = function() {
    function uniqUpdate(parent) {
        if (this.value !== parent.value) {
            this.newValue(parent.value);
        }
    }

    return stream(this, { update: uniqUpdate });
};

// stream.combine(Function f, ...Stream streams) -> Stream
//
// Create a stream that represents the value of one or more source streams
// combined by `f`. The resulting stream updates when any of the source streams
// updates.
//
// var s4 = stream.combine(add, s1, s2, s3);
//
// s1: 1     0
// s2: 2 4 3   8
// s3: 3       1
// s4: 6 8 7 6 9
stream.combine = function(f) {
    if (typeof f !== 'function') {
        throw new Error('f (' + f + ') is not a function');
    }
    var sourceStreams = Array(arguments.length - 1);
    for (var i = 1, length = arguments.length; i < length; i++) {
        sourceStreams[i - 1] = arguments[i];
    }

    function combineUpdate() {
        var parentValues = this.parents.map(function(parent) {
            return parent.value;
        });

        this.newValue(this.f.apply(this, parentValues));
    }

    return stream(sourceStreams, {
        update: combineUpdate,
        f: f
    });
};
