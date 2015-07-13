//
// 2-set-end.js
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
Stream.prototype.wasUpdated = function() {
    return this.version === stream.version;
};

// Stream::newValue(value)
//
// Update stream's value to `value` and set its `.version` to `stream.version`.
// This marks the stream as updated during this tick.
//
// Update methods should use this to set the new value.
Stream.prototype.newValue = function(value) {
    this.value = value;
    this.version = stream.version;
};

// Stream::newValue(Stream parent)
//
// An often-used shorthand for taking a value from another stream (usually
// parent of this stream).
Stream.prototype.newValueFrom = function(parent) {
    this.value = parent.value;
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
Stream.prototype.set = function(value) {
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

        s.callbacks.forEach(function(listener) {
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
    // TODO This looks like O(n^2); optimize when it's time
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

// Stream::end(optional finalValue) -> Stream
//
// Declares that this stream has done its business. Optionally set its final
// value to `finalValue` first.
//
// After the final value has been (optionally) set, ending a stream consists of
// three steps:
//
// - Set the stream's state to `ended`
// - Inform end listeners (see `.done()`, `.then()`) that this stream has ended
// - Inform children that this stream has ended (using `.parentDone()`)
//
// After children and listeners have been informed, this stream doesn't need a
// reference to them any more, so delete those links.
//
// Calling `.end()` on an ended stream has no effect.
//
// An ended stream can be used as a parent for new streams, and its value will
// be used when initializing the initial value, similarly to how you can call
// '.then()' on a resolved Promise.
//
// Return `this` for convenience.
Stream.prototype.end = function(value) {
    if (value !== undefined) {
        this.set(value);
    }

    if (this.state === 'ended') {
        return;
    }

    this.state = 'ended';

    if (this.endCallbacks) {
        this.endCallbacks.forEach(listener => {
            listener(this.value);
        });
        delete this.endCallbacks;
    }

    this.callbacks = [];

    // Tell children I'm done here, and forget them
    this.children.forEach(child => {
        child.parentDone(this);
    });
    this.children = [];

    // Ask other parents to forget me, too - an ended stream needs no
    // updates.
    this.parents.forEach(parent => {
        parent.removeChild(this);
    });
    this.parents = [];

    return this;
};

// Stream::parentDone(Stream parent)
//
// Inform the stream that its parent `parent` is done. The default behavior is
// to end the child as well. Streams that don't need this behavior should
// override `parentDone()` to do the right thing (e.g. `stream.merge` only ends
// after all of its parents have ended).
//
// If the stream is created with one or more ended parents, this method will
// be called during the initialization.
Stream.prototype.parentDone = function(parent) {
    this.end();
};
