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
// TODO good example
// TODO THIS IS BROKEN... it'll be fun continuing from here
Stream.prototype.then = function(f) {
    // `values` will be a stream (possibly) containing the value that `f`
    // returns
    var values = stream();
    var result = values.flatMap(function(value) {
        if (value instanceof Stream) {
            return stream;
        }
        return stream().set(value);
    });

    // Can we call f instantly?
    // TODO Actually flatMap not necessary in that case
    if (this.hasEnded()) {
        var value = f(this.value);
        values.set(value);
        return result;
    }

    this.addEndListener(function(finalValue) {
        var value = f(finalValue);
        values.set(value);
    });

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
