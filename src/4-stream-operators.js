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
