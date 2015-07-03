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
Stream.prototype.map = function(f) {
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
Stream.prototype.filter = function(f) {
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
Stream.prototype.uniq = function() {
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
Stream.prototype.reduce = function(f, initialValue) {
    assertFunction(f);

    function reduceUpdate(parent) {
        if (this.hasValue()) {
            this.newValue(this.f(this.value, parent.value));
        } else {
            this.newValue(parent.value);
        }
    }

    return stream(this, { update: reduceUpdate, f: f, value: initialValue })
}

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
Stream.prototype.collect = function() {
    return this.reduce(function(result, x) {
        return result.concat([x]);
    }, []);
}

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
stream.combine = function(f, ...streams) {
    assertFunction(f);

    function combineUpdate() {
        var parentValues = this.parents.map(function(parent) {
            return parent.value;
        });

        this.newValue(this.f.apply(this, parentValues));
    }

    return stream(streams, { update: combineUpdate, f: f });
};

stream.combineWhenAll = function(f) {
    // TODO
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
stream.merge = function(...streams) {
    function mergeUpdate() {
        this.parents.forEach(parent => {
            if (parent.wasUpdated()) {
                this.newValue(parent.value);
            }
        });
    }

    // Take version and value from the most recently updated parent (if one
    // exists).
    var newestParent;
    streams.forEach(parent => {
        if (!newestParent || parent.version >= newestParent.version) {
            newestParent = parent;
        }
    });

    return stream(streams, {
        update: mergeUpdate,
        value: newestParent && newestParent.value,
        version: newestParent && newestParent.version,
        // The resulting stream will end when all parent streams have ended.
        parentDone: function(parent) {
            if (this.parents.every(parent => parent.hasEnded())) {
                this.end();
            }
        }
    });
};

stream.flatMap = function() {
    // TODO
    // +Latest
    var x;
}
