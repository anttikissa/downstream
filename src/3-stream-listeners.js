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
//
//  var s = stream();
//  s.set(1);
//  s.forEach(function() { console.log(value); });  // -> 1
//  s.set(2);                                       // -> 2
Stream.prototype.forEach = function(f) {
    if (this.hasValue()) {
        f(this.value);
    }

    this.addListener(f);

    return this;
};

// Stream::addListener(Function f)
//
// Add `f` to `this.listeners`.
Stream.prototype.addListener = function(f) {
    this.listeners.push(f);
};

// Stream::removeListener(Function f)
//
// Remove the first instance of `f` from `this.listeners`, if it is there.
Stream.prototype.removeListener = function(f) {
    removeFirst(this.listeners, f);
};

// Stream::then(Function f) -> Stream
//
// Add a listener that will be called when the stream is done. Returns a
// `Stream` whose nature depends on the value returned by listener. If it
// returns a value, the resulting stream will end with that value. If it returns
// a stream, the resulting stream will update with the returned stream's values.
//
// TODO Add a good example
// TODO simplify the code - flatMap is not needed and complicates the behavior
// needlessly
Stream.prototype.then = function(f) {
    // If `value` is a Stream, return `value`
    // If not, return a stream whose value is `value`.
    function makeStream(value) {
        if (value instanceof Stream) {
            return value;
        }
        return stream().set(value);
    }

    if (this.hasEnded()) {
        return makeStream(f(this.value));
    }

    // `result` is a stream that will follow the stream (or value converted to
    // stream) returned by `f`. This is achieved using `flatMap`.
    var values = stream();
    var result = values.flatMap(makeStream);

    function thenEndListener(finalValue) {
        var value = f(finalValue);
        values.end(value);
    }

    this.addEndListener(thenEndListener);

    return result;
};

// Stream::done(Function f)
//
// Like `Stream::then()`, but for side-effects only.
//
// `Stream::done()` is to `Stream::then` like `Stream::forEach` is to
// `Stream::map`.
Stream.prototype.done = function(f) {
    if (this.hasEnded()) {
        f(this.value);
        return;
    }

    this.addEndListener(f);
};

// Stream::addEndListener(Function f)
//
// Add `f` to `this.endListeners`, which is initialized lazily.
Stream.prototype.addEndListener = function(f) {
    if (!this.endListeners) {
        this.endListeners = [];
    }
    this.endListeners.push(f);
};

// Stream::removeEndListener(Function f)
//
// Remove listener from `endListeners`.
Stream.prototype.removeEndListener = function(f) {
    if (this.endListeners) {
        removeFirst(this.endListeners, f);
    }
};
