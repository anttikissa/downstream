// downstream.js
//
// downstream.js
//
// How to read type signatures:
//
// "someFunction(Type x)" means:
// `x` must be of type `Type` in the sense that `x instanceof Type` must be true
//
// "someFunction(type x)" means:
// `x` must be of type `type` in the sense that `typeof x` must be `type`
//
// "someFunction(x)" means:
// `x` can be of any type
//
// "someFunction(optional x) means:
// `x` can be left unspecified
//
// Downstream's methods and functions appear in two namespaces:
//
// "Stream::f()" means that the function is found in `Stream.prototype`, i.e.,
// it's a method of type `Stream`
//
// "stream.f()" means that the function is is found directly in `stream`
// namespace without requiring an instance of `Stream`
//
// The `stream` namespace is what you get with:
// `var stream = require('downstream');`
//

//
// 1-stream.js
//
// This file contains the constructor new Stream(), and the equivalent function
// stream(), along with some debugging tools.
//

// Copy all attributes from 'sources' to 'target'.
'use strict';

function extend(target /*, ...sources */) {
    for (var i = 1; i < arguments.length; i++) {
        if (arguments[i]) {
            for (var key in arguments[i]) {
                target[key] = arguments[i][key];
            }
        }
    }
}

// isArray(object) -> boolean
//
// Is `object` an array?
function isArray(object) {
    return Array.isArray(object);
}

// toArray(arrayLike) -> Array
//
// Convert array-like object into an array (meant for argument lists, etc.)
function toArray(arrayLike) {
    var result = Array(arrayLike.length);
    for (var i = 0; i < arrayLike.length; i++) {
        result[i] = arrayLike[i];
    }
    return result;
}

// defer(Function f)
//
// Call 'f' a bit later.
var defer = typeof setImmediate === 'function' ? setImmediate : setTimeout;

// Type-checking utilities

// assertFunction(f)
//
// Throw user-readable error unless `f` is a function
function assertFunction(f) {
    if (typeof f !== 'function') {
        throw new Error('f (' + f + ') is not a function');
    }
}

// assertActive(Stream stream)
//
// Throw user-readable error if `stream` is ended or in error state
function assertActive(stream) {
    if (stream.state !== 'active') {
        throw new Error('stream is in state \'' + stream.state + '\', should be \'active\'');
    }
}

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
        this.parents = isArray(parentOrParents) ? parentOrParents : [parentOrParents];
    } else {
        this.parents = [];
    }

    this.children = [];
    this.listeners = [];
    this.version = 0;
    // state is one of 'active', 'ended', or 'error'
    this.state = 'active';

    this.parents.forEach(function (parent) {
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
Stream.prototype.hasValue = function () {
    return typeof this.value !== 'undefined';
};

// Stream::hasEnded() -> boolean
//
// Has this stream ended?
Stream.prototype.hasEnded = function () {
    return this.state === 'ended';
};

// Stream::addChild(Stream child)
//
// Register `child` as my child
Stream.prototype.addChild = function (child) {
    this.children.push(child);
};

// It's an error if a stream that doesn't have an `update` function gets
// updated; the default implementation ensures that you get this message instead
// of "Cannot read property 'apply' of undefined" or equivalent
//
Stream.prototype.update = function () {
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
Stream.prototype.log = function (prefix) {
    if (prefix) {
        this.forEach(function (value) {
            console.log(prefix, value);
        });
    } else {
        this.forEach(function (value) {
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
Stream.prototype.wasUpdated = function () {
    return this.version === stream.version;
};

// Stream::newValue(value)
//
// Update stream's value to `value` and set its `.version` to `stream.version`.
// This marks the stream as updated during this tick.
//
// Update functions should use this to set the new value.
Stream.prototype.newValue = function (value) {
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
Stream.prototype.set = function (value) {
    assertActive(this);

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

        s.listeners.forEach(function (listener) {
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
stream.updateOrder = function (source) {
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
    dfsTraversalOrder.forEach(function (node, idx) {
        if (isLastIndexOf(node, idx)) {
            result.push(node);
        }
    });

    return result;
};

// Stream::end()
//
// Declares that this stream has done its business, and that its final value is
// `this.value`.
//
// `Stream::end()` is to `Stream::then` and `Stream::done` what
// `Stream::set()` is to `Stream::forEach`.
//
// Ending a stream consists of three steps:
//
// - Set my state to `ended`
// - Inform end listeners that this stream has ended
// - Inform children that this stream has ended
//
// After children and listeners have been informed, this stream doesn't need a
// reference to them any more, so delete those links.
//
// If you want to end a stream with a value, call `this.set(finalValue)` first.
Stream.prototype.end = function () {
    // TODO make sure this is necessary
    assertActive(this);

    this.state = 'ended';

    if (this.endListeners) {
        this.endListeners.forEach(function (listener) {
            listener(this.value);
        }, this);
    }

    this.listeners = [];

    this.children.forEach(function (child) {
        // Maybe child.parentHasEnded(this)
        // so they can override the ending behavior
        child.end();
    });

    this.children = [];
};

//
// 3-stream-listeners.js
//
// This file is about listeners: adding and removing them from streams.
//
// `Stream::forEach()` is the primary way to add listeners. Internally, it calls
// `Stream::addListener()`, and you can call `Stream::removeListener` to remove
// the link to the listener.
//
// Eventually, there will be possibility to listen to errors and ends in
// addition to values. Wait and see.
// TODO fill in Stream::then() here
//
// In general, the following rules apply to all listeners:
//
// - Trying to remove a listener that hasn't been added is a no-op.
// - You can add the same listener more than once.
// - In that case, you must remove the listener as many times as you added it.
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
Stream.prototype.forEach = function (f) {
    if (this.hasValue()) {
        f(this.value);
    }

    this.addListener(f);

    return this;
};

// Stream::addListener(Function f)
//
// Add `f` to `this.listeners`.
Stream.prototype.addListener = function (f) {
    this.listeners.push(f);
};

// Stream::removeListener(Function f)
//
// Remove the first instance of `f` from `this.listeners`, if it is there.
Stream.prototype.removeListener = function (f) {
    var idx = this.listeners.indexOf(f);
    if (idx !== -1) {
        this.listeners.splice(idx, 1);
    }
};

// Stream::then(Function f) -> Stream
//
// Add a listener that will be called when the stream is done. Returns a
// `Stream` whose nature depends on the value returned by listener. If it
// returns a value, the resulting stream will end with that value. If it returns
// a stream, the resulting stream will update with the returned stream's values.
//
// TODO good example
Stream.prototype.then = function (f) {
    if (this.hasEnded()) {
        f(this.value);
        // No need to addEndListener(), since end only happens once
        return;
    }

    this.addEndListener(f);

    var result = stream();

    // TODO implement when flatMap is there
    return result;
};

// Stream::done(Function f)
//
// Like `Stream::then()`, but for side-effects only.
//
// `Stream::done()` is to `Stream::then` like `Stream::forEach` is to
// `Stream::map`.
Stream.prototype.done = function (f) {
    // TODO extract this maybe
    if (this.hasEnded()) {
        f(this.value);
        return;
    }

    this.addEndListener(f);
};

// Stream::addEndListener(Function f)
//
// Add `f` to `this.endListeners`, which is initialized lazily.
Stream.prototype.addEndListener = function (f) {
    if (!this.endListeners) {
        this.endListeners = [];
    }
    this.endListeners.push(f);
};

// Stream::removeEndListener(Function f)
//
// Remove listener from `endListeners`.
Stream.prototype.removeEndListener = function (f) {
    if (this.endListeners) {
        // TODO refactoring opportunity: extract "remove from array"
        var idx = this.endListeners.indexOf(f);
        if (idx !== -1) {
            this.endListeners.splice(idx, 1);
        }
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
// A stream of `f(x)` for every value `x` of this stream.
//
//  var s2 = s1.map(function(value) { return value + 1; });
//
//  s1: 1 1 2 2 5 6 6
//  s2: 2 2 3 3 6 7 7
Stream.prototype.map = function (f) {
    assertFunction(f);

    function mapUpdate(parent) {
        this.newValue(this.f(parent.value));
    }

    return stream(this, { update: mapUpdate, f: f });
};

// Stream::filter(Function f) -> Stream
//
// A stream of `x` for every value `x` of this stream for which `f(x)` is true.
//
//  var s2 = s1.filter(function(n) { return n % 2; });
//
//  s1: 1 1 2 2 5 6 6
//  s2: 1 1     5
Stream.prototype.filter = function (f) {
    assertFunction(f);

    function filterUpdate(parent) {
        if (this.f(parent.value)) {
            this.newValue(parent.value);
        }
    }

    return stream(this, { update: filterUpdate, f: f });
};

// Stream::uniq() -> Stream
//
// A stream of `x` for every value `x` of this stream for which
// `x !== previous x` is true.
//
// In other words, only update when the new value is different from the old one,
// like the UNIX tool `uniq(1)`.
//
// The equality check used is `===`, so you might not get the expected result if
// your stream gives `NaN` values (because `NaN !== NaN`).
//
//  var s2 = s1.uniq();
//
//  s1: 1 1 2 2 5 6 6
//  s2: 1   2   5 6
Stream.prototype.uniq = function () {
    function uniqUpdate(parent) {
        if (this.value !== parent.value) {
            this.newValue(parent.value);
        }
    }

    return stream(this, { update: uniqUpdate });
};

// Stream::reduce(Function f, optional any initialValue) -> Stream
//
// A stream of `f(previous x, x)` for every value `x` of this stream, except for
// the first value that is `initialValue` or `this.value` if only one of them is
// defined.
//
// If `initialValue` is provided, the stream starts with the value
// `initialValue`; if the parent also has a value at that time (`value`), the
// stream starts with the value `f(initialValue, value)`.
//
// If `initialValue` is not provided, the stream starts with the parent stream's
// value (which may be `undefined`).
//
// You can think of Stream::reduce() as an Array::reduce() in the time
// dimension, and with the following main differences:
//
// - Stream::reduce() provides the user with the intermediate results as they
//   become available. If you just need the final result when the parent stream
//   is done, use `s.reduce(...).then(...)`.
// - It's an error to give `Array::reduce()` an empty array and no initial
//   value, but giving `Stream::reduce()` an empty stream is perfectly fine,
//   even though there is no initial value (and results in an empty stream).
// - Unlike Array::reduce(), Stream::reduce() calls its callback with just two
//   arguments: the current value of the accumulator, and the next value.
//
// An example with a symmetric callback (one that takes two arguments of the
// same type):
//
//  var s1 = stream();
//  var s2 = s1.reduce(function(x, y) { return x + y; });
//
//  s1  1   2   3   4    5
//  s2  1   3   6   10   15
//
// An example with an asymmetric callback (one that takes an accumulator of one
// type and a value of another type):
//
//  var s3 = stream();
//  var s4 = s1.reduce(function(result, x) { return result.concat(x); }, []);
//
//  s3      1     2        3
//  s4 []   [1]   [1, 2]   [1, 2, 3]
//
Stream.prototype.reduce = function (f, initialValue) {
    assertFunction(f);

    function reduceUpdate(parent) {
        if (this.hasValue()) {
            this.newValue(this.f(this.value, parent.value));
        } else {
            this.newValue(parent.value);
        }
    }

    return stream(this, { update: reduceUpdate, f: f, value: initialValue });
};

// stream.combine(Function f, ...Stream streams) -> Stream
//
// A stream of `f(value1, value2, ...)` that updates whenever one or
// more of `streams` updates. (Their values being `value1` etc.)
//
// Intended to be used for streams that already have values (or with an `f` that
// tolerates lack of parameters). If you need all source streams to have
// values before `f` can produce its first value, use `stream.combineWhenAll`.
//
//  var s4 = stream.combine(add, s1, s2, s3);
//
//  s1: 1     0
//  s2: 2 4 3   8
//  s3: 3       1
//  s4: 6 8 7 6 9
stream.combine = function (f) {
    assertFunction(f);

    var sourceStreams = Array(arguments.length - 1);
    for (var i = 1, length = arguments.length; i < length; i++) {
        sourceStreams[i - 1] = arguments[i];
    }

    function combineUpdate() {
        var parentValues = this.parents.map(function (parent) {
            return parent.value;
        });

        this.newValue(this.f.apply(this, parentValues));
    }

    return stream(sourceStreams, { update: combineUpdate, f: f });
};

stream.combineWhenAll = function (f) {};

// stream.merge(...Stream streams) -> Stream
//
// A stream of `x` for every updating parent's value `x`
//
// Create a stream that merges 1 or more streams (or, in the degenerate case,
// 0). Whenever one of its parent streams updates, with the value of that
// stream.
//
// If two or more of its parent streams updates at the same tick, the resulting
// stream will update only once. The value will be taken from the stream that
// comes later in the argument list.
//
// The resulting stream gets its initial value from the parent that was updated
// most recently (it peeks at the streams' `version` properties and chooses the
// newest one).
stream.merge = function () {
    var sourceStreams = toArray(arguments);
    // TODO
};

stream.flatMap = function () {
    // TODO
    // +Latest
    var x;
}

// end of downstream.js
//# sourceMappingURL=downstream.js.map
;
// TODO