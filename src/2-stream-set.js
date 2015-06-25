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
Stream.prototype.end = function() {
    // TODO make sure this is necessary
    assertActive(this);

    this.state = 'ended';

    if (this.endListeners) {
        this.endListeners.forEach(function(listener) {
            listener(this.value);
        }, this);
    }

    this.listeners = [];

    this.children.forEach(function(child) {
        // Maybe child.parentHasEnded(this)
        // so they can override the ending behavior
        child.end();
    });

    this.children = [];
};
