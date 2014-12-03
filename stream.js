
// Chapter 1 - Stream and stream

function Stream(value) {
    this.value = value;
    this.children = [];
    this.listeners = [];
    this.parents = [];
    this.version = stream.version;
}

function stream(value) {
    return new Stream(value);
}

// Whenever stream.set() is called, this number is incremented.
// All streams whose value is set through .newValue() have their .version assigned to this,
// so we can know which streams received a new value during the current tick.
// (Stream.wasChanged() tells if a stream was.)
stream.version = 0;

// Chapter 2 - Stream utilities

// Produce a stream that yields values whenever event 'eventType' is fired for
// selector specified by 'selector'.  Assumes a single DOM element that matches
// the selector, otherwise throws.
stream.fromDomEvent = function(selector, eventType) {
    var element = document.querySelector(selector);
    if (!element) {
        throw new Error('element not found');
    }
    var result = stream();
    element.addEventListener(eventType, function(ev) {
        result.set(ev);
    });
    return result;
};

var defer = typeof setImmediate === 'function' ? setImmediate : setTimeout;

// Produce a stream that yields the elements of array as fast as it can.
stream.fromArray = function(array) {
    var result = stream();

    var index = 0;
    function takeNext() {
        if (index === array.length) {
            return;
        }
        result.set(array[index++]);
        defer(takeNext);
    }

    takeNext();

    return result;
};

// Given that the value of 'source' is set, which streams should we consider
// updating and in which order?
//
// I.e. a topological ordering of streams reachable from 'source' through parent-child
// relationships.
//
// var s = stream();
// var s2 = s.map(inc);
// var s3 = s.map(inc);
// var s4 = s2.combine(s3, plus);
//
// updateOrder(s) => [ s, s2, s3, s4 ]
//
// Internally used by stream.set().
stream.updateOrder = function(source) {
    var dfsTraversalOrder = [];

    function dfs(node) {
        dfsTraversalOrder.push(node);
        node.children.forEach(dfs);
    }

    dfs(source);

    // 'dfsTraversalOrder' is now a depth-first traversal of nodes:
    //
    // dfsTraversalOrder = [ 1, 2, 4, 3, 4 ]
    //
    // from which we will pick the last occurrence of each node:
    //
    // result = [ 1, 2,    3, 4 ]
    function isLastIndexOf(node, idx) {
        // TODO this could be faster than O(n)
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

// Set the value of this stream to 'value'.
// Transitively update all streams that depend on this.
// After a stream's value has been updated, call its listeners with the new value.
//
// Return 'this' so you can do s.set(1).set(2)... or whatever.
Stream.prototype.set = function(value) {
    stream.version++;

    var streamsToUpdate = stream.updateOrder(this);

    this.newValue(value);

    streamsToUpdate.forEach(function(s) {
        if (s.update) {
            if (s.parents.some(function(parent) { return parent.wasChanged(); })) {
                s.update.apply(s, s.parents);
            }
        }

        s.listeners.forEach(function(f) {
            if (s.wasChanged()) {
                // TODO eventually there will probably come a need to set 'this' to 's'
                // for the following function call. When that happens, remember to change
                // .onValue(), too.
                f(s.value);
            }
        });
    });

    return this;
};

// Give stream a name. For debugging.
Stream.prototype.name = function(name) {
    this._name = name;
    return this;
};

// Update stream's value to 'value' and update its version to the latest one.
// Update functions should use this to set the new value.
Stream.prototype.newValue = function(value) {
    this.value = value;
    this.version = stream.version;
};

// Was stream updated since the start of the most recent tick?
// Typically used by update functions that need to know which parent caused the update.
Stream.prototype.wasChanged = function() {
    return this.version === stream.version;
};

// Add 'child' as a dependency of this stream.
// TODO implement removeChild and call it in appropriate places.
Stream.prototype.addChild = function(child) {
    child.parents.push(this);
    this.children.push(child);
};

// Chapter 3. Stream operators

// Copy all attributes from 'sources' to 'target'.
function extend(target /*, sources ... */) {
    for (var i = 1; i < arguments.length; i++) {
        if (arguments[i]) {
            for (var key in arguments[i]) {
                target[key] = arguments[i][key];
            }
        }
    }
}

// Create a stream that depends on this stream, install an update handler
// on it and calls it if this stream has a value.  This should be used
// by most stream operators that take a single parent stream, such as
// map, filter, uniq, etc.
Stream.prototype.derive = function(update, options) {
    var result = stream();

    extend(result, options, { update: update });

    this.addChild(result);

    if (this.hasValue()) {
        result.update(this);
    }

    return result;

};

// Exactly like Stream.derive(), but works on two or more streams.
stream.derivedStream = function(parents, update, options) {
    var result = stream();

    extend(result, options, { update: update });

    parents.forEach(function(parent) {
        parent.addChild(result);
    });

    if (parents.some(function(parent) { return parent.hasValue(); })) {
        result.update.apply(result, result.parents);
    }

    return result;
};

// A stream whose value is updated with 'f(x)' whenever this
// stream's value is updated with 'x'.
//
// var s2 = s1.map(function(value) { return value + 1; });
//
// s1: 1 1 2 2 5 6 6
// s2: 2 2 3 3 6 7 7
Stream.prototype.map = function(f) {
    function mapUpdate(parent) {
        this.newValue(this.f(parent.value));
    };

    return this.derive(mapUpdate, { f: f });
};

// Return a stream whose value is updated with 'x' whenever this
// stream's value is updated with 'x', if 'f(x)' is true.
//
// var s2 = s1.filter(isOdd);
//
// s1: 1 1 2 2 5 6 6
// s2: 1 1     5
Stream.prototype.filter = function(f) {
    function filterUpdate(parent) {
        if (this.f(parent.value)) {
            this.newValue(parent.value);
        }
    };

    return this.derive(filterUpdate, { f: f });
};

// Return a stream that follows its parent's values, but only updates
// when the value changes.  Similar to the UNIX tool uniq(1).
//
// var s2 = s1.uniq()
//
// s1: 1 1 2 2 5 6 6
// s2: 1   2   5 6
Stream.prototype.uniq = function() {
    function uniqUpdate(parent) {
        if (parent.value !== this.value) {
            this.newValue(parent.value);
        }
    }

    return this.derive(uniqUpdate);
};

Stream.prototype.combine = function(other, f) {
    function combineUpdate(parent1, parent2) {
        this.newValue(this.f(parent1.value, parent2.value));
    };

    return stream.derivedStream([ this, other ], combineUpdate, { f: f });
};

Stream.prototype.sampledBy = function(other) {
    function sampledByUpdate(source, sampler) {
        if (sampler.wasChanged()) {
            this.newValue(source.value);
        }
    }

    return stream.derivedStream([ this, other ], sampledByUpdate);
};


Stream.prototype.hasValue = function() {
    return typeof this.value !== 'undefined';
};

Stream.prototype.onValue = function(f) {
    if (this.hasValue()) {
        f(this.value);
    }

    this.addListener(f);
};

Stream.prototype.addListener = function(f) {
    this.listeners.push(f);
};

Stream.prototype.removeListener = function(f) {
    var idx = this.listeners.indexOf(f);
    if (idx !== -1) {
        this.listeners.splice(idx, 1);
    }
};

Stream.prototype.log = function(prefix) {
    this.onValue(function(value) {
        if (prefix) {
            console.log(prefix, value);
        } else {
            console.log(value)
        }
    });
    return this;
};

Stream.prototype.merge = function(other) {
    function mergeUpdate(parent1, parent2) {
        if (parent1.wasChanged()) {
            this.newValue(parent1.value);
        }

        if (parent2.wasChanged()) {
            this.newValue(parent2.value);
        }
    }

    return stream.derivedStream([ this, other ], mergeUpdate);
};

Stream.prototype.scan = function(initial, f) {
    function scanUpdate(parent) {
        this.newValue(this.f(this.value, parent.value));
    }

    return this.derive(scanUpdate, { value: initial, f: f });
};

Stream.prototype.slidingWindow = function(n) {
    function slidingWindowUpdate(parent) {
        // TODO test this
        var newValue = this.value.concat([ parent.value ]);
        if (newValue.length > this.n) {
            newValue.shift();
        }
        this.newValue(newValue);
    }

    return this.derive(slidingWindowUpdate, { value: [], n: n });
};

Stream.prototype.slidingWindowBy = function(lengthStream) {
    function slidingWindowByUpdate(parent, lengthStream) {
        // TODO does not take correctly into account the situation when
        // lengthStream yields smaller values than parent.length
        if (parent.wasChanged()) {
            var newValue = this.value.concat([ parent.value ]);
            while (newValue.length > lengthStream.value) {
                newValue.shift();
            }
            this.newValue(newValue);
        }
    }

    return stream.derivedStream([ this, lengthStream ], slidingWindowByUpdate, { value: [] });
};

Stream.prototype.take = function(n) {
    function takeUpdate(parent) {
        if (this.n > 0) {
            this.newValue(parent.value);
            this.n--;
        }
    }

    return this.derive(takeUpdate, { n: n });
};

Stream.prototype.flatMap = function(f) {
    function flatMapUpdate(parent) {
        if (parent.wasChanged()) {
            this.f(parent.value).addChild(this);
        }

        for (var i = 1; i < this.parents.length; i++) {
            if (this.parents[i].wasChanged()) {
                this.newValue(this.parents[i].value);
            }
        }
    }

    return this.derive(flatMapUpdate, { f: f });
};

Stream.prototype.flatMapLatest = function(f) {
    // TODO better replace the dependency instead of just adding new ones
    function flatMapLatestUpdate(parent) {
        if (parent.wasChanged()) {
            f(parent.value).addChild(this);
        }

        if (this.parents.length > 1) {
            var lastParent = this.parents[this.parents.length - 1];
            if (lastParent.wasChanged()) {
                this.newValue(lastParent.value);
            }
        }
    }

    return this.derive(flatMapLatestUpdate);
};

// Now what's the purpose of this, I don't know
Stream.prototype.toProperty = function(initial) {
    function toPropertyUpdate(parent) {
        this.newValue(parent.value);
    }

    var result = this.derive(toPropertyUpdate);
    result.value = initial;
    return result;
};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = stream;
}
