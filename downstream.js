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
// 0-utils.js
//
// This file contains internal utility functions.
//

// Copy all attributes from 'sources' to 'target'.
'use strict';

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

function extend(target) {
    for (var _len = arguments.length, sources = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        sources[_key - 1] = arguments[_key];
    }

    sources.forEach(function (object) {
        if (object) {
            for (var key in object) {
                target[key] = object[key];
            }
        }
    });

    return target;
}

// removeFirst(Array array, object object)
//
// Remove the first occurrence of `object` from `array`.
function removeFirst(array, object) {
    var index = array.indexOf(object);
    if (index !== -1) {
        array.splice(index, 1);
    }
}

// defer(Function f)
//
// Call 'f' a bit later.
// var defer = typeof setImmediate === 'function' ? setImmediate : setTimeout;

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

// assertSource(Stream stream)
//
// Throw user-readable error if `stream` is not a source stream
function assertSourceStream(stream) {
    if (stream.update !== Stream.prototype.update) {
        throw new Error('stream is not a source stream');
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
function Stream() {
    var _this = this;

    var parentOrParents = arguments[0] === undefined ? [] : arguments[0];
    var options = arguments[1] === undefined ? {} : arguments[1];

    // This lets you use both `[parent1, parent2, ...]` and `parent`
    this.parents = [].concat(parentOrParents);

    this.children = [];
    this.listeners = [];
    // state is one of 'active', 'ended', or 'error'
    this.state = 'active';

    this.parents.forEach(function (parent) {
        if (!(parent instanceof Stream)) {
            throw new Error('parent ' + parent + ' is not a Stream');
        }
        parent.addChild(_this);
    });

    this.version = 0;

    extend(this, options);

    // Establish the initial value: if some of my parents had a value, then run
    // the update function to potentially give this stream a value, too.
    if (this.parents.some(function (parent) {
        return parent.hasValue();
    })) {
        this.update.apply(this, _toConsumableArray(this.parents));

        // If the update call above did set a value, it also set `this.version`
        // to `stream.version`, which is nonzero.
        if (this.version > 0) {
            // Pretend that this stream was around when its parents where last
            // updated, and that this stream was updated at the same tick. This
            // is necessary because some operators (e.g. `stream.merge(...)`)
            // want to know which stream is newer.
            this.version = Math.max.apply(Math, _toConsumableArray(this.parents.map(function (parent) {
                return parent.version;
            })));
        }
    }
}

// Stream::hasValue() -> boolean
//
// Does this stream have a value?
Stream.prototype.hasValue = function () {
    return this.value !== undefined;
};

// Stream::hasEnded() -> boolean
//
// Has this stream ended?
Stream.prototype.hasEnded = function () {
    return this.state === 'ended';
};

// Stream::addChild(Stream child)
//
// Register `child` as my child. The child calls this when it's created.
Stream.prototype.addChild = function (child) {
    this.children.push(child);
};

// Stream::removeChild(Stream child)
//
// Unregister `child`. The child calls this near the end of its life.
Stream.prototype.removeChild = function (child) {
    removeFirst(this.children, child);
};

// Stream::addParent(Stream parent)
//
// Establish a parent-child relationship between me and `parent`. The child
// calls this when it needs to listen to a new parent, often from the `update`
// method.
Stream.prototype.addParent = function (parent) {
    this.parents.push(parent);
    parent.addChild(this);
};

// It's an error if a stream that doesn't have an `update` function gets
// updated; the default implementation ensures that you get this message instead
// of "Cannot read property 'apply' of undefined" or equivalent.
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
// This file contains methods that can be used to modify streams' state:
//
// - `Stream::set()` and the associated machinery
// - `Stream::end()`
// - TODO eventually `Stream::throw()`
//

// An increasing number that is incremented every time `Stream::set()` is
// called.
//
// All streams that are updated as result will get their `.version` bumped to
// the new value.
//
// Every stream starts with its version set to 0, regardless of whether it has
// an initial value; it becomes nonzero when `set()` is called on the stream, or
// when it is updated as the result of one of its parents updating.
//
// `Stream::wasUpdated()` uses the version to determine if stream was
// changed during the most recent tick.
//
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
// Update methods should use this to set the new value.
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
// Return `this` for convenience. For example, to start a stream with a value,
// you can say:
//
//  var s = stream().set(initialValue);
//
Stream.prototype.set = function (value) {
    assertActive(this);
    assertSourceStream(this);

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
    // TODO This looks like O(n^2); optimize when it's time
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
// Ending a stream consists of three steps:
//
// - Set my state to `ended`
// - Inform end listeners that this stream has ended
// - Inform children that this stream has ended
//
// After children and listeners have been informed, this stream doesn't need a
// reference to them any more, so delete those links.
//
// Calling `.end()` on an ended stream has no effect.
//
// If you want to end a stream with a value, call `this.set(finalValue)` first.
Stream.prototype.end = function () {
    var _this2 = this;

    if (this.state === 'ended') {
        return;
    }

    this.state = 'ended';

    if (this.endListeners) {
        this.endListeners.forEach(function (listener) {
            listener(_this2.value);
        });
        delete this.endListeners;
    }

    this.listeners = [];

    // Tell children I'm done here, and forget them
    this.children.forEach(function (child) {
        child.parentDone(_this2);
    });
    this.children = [];

    // Ask other parents to forget me, too - an ended stream needs no
    // updates.
    this.parents.forEach(function (parent) {
        parent.removeChild(_this2);
    });
    this.parents = [];
};

// Stream::parentDone(Stream parent)
//
// Inform the stream that its parent `parent` is done. The default behavior is
// to end the child as well. Streams that don't need this behavior should
// override `parentDone()` to do the right thing (e.g. `stream.merge` only ends
// after all of its parents have ended).
Stream.prototype.parentDone = function (parent) {
    this.end();
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
    removeFirst(this.listeners, f);
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
        removeFirst(this.endListeners, f);
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

// Stream::collect() -> Stream
//
// A stream of arrays of every value so far seen on the parent stream.
//
// var s1 = stream();
// var s2 = stream.collect();
//
// s1  1    2       3
// s2  [1]  [1, 2]  [1, 2, 3]
//
Stream.prototype.collect = function () {
    return this.reduce(function (result, x) {
        return result.concat([x]);
    }, []);
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

    function combineUpdate() {
        var parentValues = this.parents.map(function (parent) {
            return parent.value;
        });
        this.newValue(this.f.apply(this, _toConsumableArray(parentValues)));
    }

    for (var _len2 = arguments.length, streams = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        streams[_key2 - 1] = arguments[_key2];
    }

    return stream(streams, { update: combineUpdate, f: f });
};

stream.combineWhenAll = function (f) {
    assertFunction(f);

    function combineWhenAllUpdate() {
        var parentValues = this.parents.map(function (parent) {
            return parent.value;
        });
        if (parentValues.every(function (value) {
            return value !== undefined;
        })) {
            this.newValue(this.f.apply(this, _toConsumableArray(parentValues)));
        }
    }

    for (var _len3 = arguments.length, streams = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
        streams[_key3 - 1] = arguments[_key3];
    }

    return stream(streams, { update: combineWhenAllUpdate, f: f });
};

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
    function mergeUpdate() {
        var _this3 = this;

        this.parents.forEach(function (parent) {
            if (parent.wasUpdated()) {
                _this3.newValue(parent.value);
            }
        });
    }

    // Take version and value from the most recently updated parent (if one
    // exists).
    var newestParent;

    for (var _len4 = arguments.length, streams = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
        streams[_key4] = arguments[_key4];
    }

    streams.forEach(function (parent) {
        if (!newestParent || parent.version >= newestParent.version) {
            newestParent = parent;
        }
    });

    return stream(streams, {
        update: mergeUpdate,
        value: newestParent && newestParent.value,
        version: newestParent && newestParent.version,
        // The resulting stream will end when all parent streams have ended.
        parentDone: function parentDone() {
            if (this.parents.every(function (parent) {
                return parent.hasEnded();
            })) {
                this.end();
            }
        }
    });
};

// Stream::flatMap(Function f) -> Stream
//
// For every value `x` of this stream, call `f(x)` to produce a new stream, and
// merge all resulting streams. So at any given time, the resulting stream works
// like `stream.merge(f(s1), f(s2), ...)`, where `s1`, `s2` etc. are all
// of the parent's values up to that point.
//
// A fine point in semantics: if `f` returns a stream with a value, the
// flatMapped stream will only update with that value if the new stream's
// version is newer than the previous ones. In other words, `.flatMap()` will
// always reflect the newest value it has seen in its parent streams.
//
// Similarly to `stream.merge()`, if two or more of its parent streams updates
// at the same tick, the resulting stream will update only once. The value will
// be taken from the stream that was added later.
//
// But usually you don't need to bother yourself with the detailed semantics
// mentioned above. The most popular use is to combine the results of
// asynchronous operations initiated by a stream update.
//
// TODO ajax example or something.
//
//  var s = stream.from([1, 4, 7]).interval(500);
//  var result = s.flatMap(function f(x) {
//      return stream.from([s, s + 1, s + 2]).interval(300);
//  };
//
// `s1`, `s2`, and `s3` are the streams created by feeding values of `s` into f:
//
//  s        1    4    7
//  s1       1  2  3
//  s2            4  5  6
//  s3                 7  8  9
//  result   1  2 43 5 76 8  9
//
Stream.prototype.flatMap = function (f) {
    function flatMapUpdate(metaParent) {
        var _this4 = this;

        for (var _len5 = arguments.length, parents = Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
            parents[_key5 - 1] = arguments[_key5];
        }

        // flatMap is different from most streams in that it has two kinds of
        // parents. The first one we call `metaParent`, and it's the one that
        // `.flatMap()` was originally called on - the stream whose updates
        // cause adding of new parents.
        //
        // The rest, `parents`, are the results of `f(x)` where `x` is a value
        // of `metaParent`. They are the stream's "real" parents in the sense
        // that it's only them that cause the flatMapped stream to update.
        parents.forEach(function (parent) {
            if (parent.wasUpdated()) {
                _this4.newValue(parent.value);
                _this4.mostRecentParentVersion = parent.version;
            }
        });

        // Handle the first parent after the regular parents have been checked,
        // since it might add another parent which can also change my value.
        if (metaParent.wasUpdated()) {
            // Add a new parent. If its value is newer than my previous parents'
            // most recent value, take its value, too.
            var newParent = this.f(metaParent.value);
            this.addParent(newParent);

            if (newParent.version >= this.mostRecentParentVersion) {
                this.newValue(newParent.value);
                // `mostRecentParentVersion` is the maximum version of any
                // parents I have now or have ever had, except for `metaParent`.
                // `mostRecentParentVersion` can be older than `this.version` in
                // those cases when I get a new parent that already has a value,
                // and therefore needs to be remembered here. Note that we
                // cannot compute this on the fly, since some of the parents
                // might have ended, and thus removed from the parents list.
                this.mostRecentParentVersion = newParent.version;
            }
        }
    };

    return stream(this, {
        update: flatMapUpdate,
        f: f,
        mostRecentParentVersion: 0
    });
};

// end of downstream.js
//# sourceMappingURL=downstream.js.map