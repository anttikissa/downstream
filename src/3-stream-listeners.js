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
Stream.prototype.then = function(f) {
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
Stream.prototype.done = function(f) {
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
        // TODO refactoring opportunity: extract "remove from array"
        var idx = this.endListeners.indexOf(f);
        if (idx !== -1) {
            this.endListeners.splice(idx, 1);
        }
    }
};
