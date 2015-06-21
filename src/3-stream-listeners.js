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
