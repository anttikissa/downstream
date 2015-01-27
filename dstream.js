// Chapter 0 - Internal utilities

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

function isArray(object) {
    // TODO compatibility
	return Array.isArray(object);
}

function isStream(object) {
    return object instanceof Stream;
}

// Testing utils (in test environment, these exist and do what they say)
if (typeof test !== 'function') {
    var test = function() {};
}

if (typeof assert !== 'function') {
    var assert = function() {};
    assert.eq = function() {};
}

// Update function for identity stream (copy parent's value)
function copyUpdate(parent) {
    this.newValue(parent.value);
}


// Chapter 1 - Stream() and stream()

// Stream constructor.
//
//     new Stream()
//
// Create a source stream.  A source stream has no value nor parents nor
// children (yet).  You can set its value with .set(value).
//
//     new Stream(
//         Stream parent | Stream[] parents,
//         optional Function update,
//         optional Object options)
//
// Create a derived stream.  The derived streams gets its value via an update
// function, which is called with the stream's parents as arguments and the
// stream itself as 'this'.  The update function may call this.newValue() to
// update the stream's value.
//
// If no update function is specified, copyUpdate is used, which just copies
// the first parent's value to the stream.
//
// If the options object is specified, the stream is extended with its
// properties.
function Stream(parentOrParents, update, options) {
    this.children = [];
    this.listeners = [];
    parentOrParents = parentOrParents || [];
    this.parents = isArray(parentOrParents)
        ? (parentOrParents)
        : [ parentOrParents ];
    this.update = update || copyUpdate;
    this.version = stream.version;

    extend(this, options);

    this.parents.forEach(function(parent) {
        parent.children.push(this);
    }, this);

    function hasValue(s) {
        return s.hasValue();
    }

    if (this.update && this.parents.some(hasValue)) {
        this.update.apply(this, this.parents);
    }
}

// A shorthand for new Stream(...).
//
// Also, acts as a namespace for exported methods that don't logically
// belong into Stream.prototype.
function stream(parentOrParents, update, options) {
    return new Stream(parentOrParents, update, options);
}

test('stream()', function() {
    var s = stream();
    assert(s.value === undefined);
    assert.eq(s.parents, []);
    assert.eq(s.children, []);

    s.set(123);
    assert.eq(s.value, 123)
});

test('stream(parent)', function() {
    var s = stream();
    s.set(123);
    var s2 = stream(s);
    assert.eq(s2.value, s.value);
});

test('stream(parent, update)', function() {
    var s = stream();

    // Also a partial test for stream.set(); no worries
    var s2 = stream(s, function(parent) { this.newValue(parent.value * 2) });

    s.set(123);
    assert.eq(s2.value, 246);
});

test('stream(parents, update)', function() {
    var s = stream();
    var s2 = stream();

    var timesParentUpdated = 0;
    function update() { timesParentUpdated++; }

    stream([ s, s2 ], update);
    s.set(1);
    assert.eq(timesParentUpdated, 1);
    s2.set(1);
    assert.eq(timesParentUpdated, 2);
});

test('stream(parent, update, options)', function() {
    var s = stream();

    var s2 = stream(s, function foo() {}, {
        state: 0, f: function(x) { return x * 2 }
    });

    assert.eq(s2.update.name, 'foo');
    assert.eq(s2.state, 0);
    assert.eq(s2.f(10), 20);
});

// Whenever stream.set() is called, this number is incremented.
// All streams whose value is set through .newValue() have their .version
// assigned to this, so we can call s.wasChanged() to tell if a s received
// a new value during the most recent tick.
stream.version = 0;


// Chapter 2 - Mostly bookkeeping and accessors

Stream.prototype.hasValue = function() {
    return typeof this.value !== 'undefined';
};

test('hasValue()', function() {
    test('before setting a value');
    var s = stream();
    assert(s.hasValue() === false);

    test('after setting a value');
    s.set(1);
    assert(s.hasValue() === true);
});

// Call f(value) for every value that the stream has.
//
// If a stream has a value when forEach() is called, f will be called right
// away with the current value.  After the stream has ended, f will no longer
// be called.
//
// Returns the stream itself.
Stream.prototype.forEach = function(f) {
    if (this.hasValue()) {
        f(this.value);
    }

    this.addListener(f);

    return this;
};

test('forEach()', function() {
    var s = stream();
    var result = [];

    s.forEach(result.push.bind(result));

    test('listener not called if stream had no value when calling forEach');
    assert.eq(result, []);

    test('listener is called if stream had a value when calling forEach');
    var s2 = stream().set(1);
    var forEachResult = s2.forEach(result.push.bind(result));
    assert.eq(result, [ 1 ]);

    test('forEach returns the stream itself');
    assert(forEachResult === s2);

    result.length = 0;

    test('listener is called when .set() is called on the stream');
    s.set(2);
    assert.eq(result, [ 2 ]);
});

// Called internally by forEach().
Stream.prototype.addListener = function(f) {
    this.listeners.push(f);
};

// Remove a listener added by forEach().
// You can add the same listener many times, and you must call removeListener()
// as many times as you called forEach() in order to remove all listeners.
// Calling removeListener() with a function that is not a listener of the
// stream has no effect.
Stream.prototype.removeListener = function(f) {
    var idx = this.listeners.indexOf(f);
    if (idx !== -1) {
        this.listeners.splice(idx, 1);
    }
};

test('addListener() and removeListener()', function() {
    var s = stream();
    function f() {}
    function f2() {}
    test('listeners can be added many times');
    s.addListener(f);
    s.addListener(f);
    assert(s.listeners.length === 2);
    s.addListener(f2);
    s.addListener(f);

    assert(s.listeners.length === 4);

    test('removeListener(f) can be called as many times as addListener(f)');
    s.removeListener(f);
    assert(s.listeners.length === 3);
    s.removeListener(f);
    assert(s.listeners.length === 2);
    s.removeListener(f);
    assert(s.listeners.length === 1);
    test('removeListener(f) has no effect is f was not added as a listener');
    s.removeListener(f);
    assert(s.listeners.length === 1);
});

// Call f() when the stream ends.
//
// If the stream has ended when then() is called, f will be called right away.
// f will always be called at most once.
// TODO make streams chainable like promises
// TODO wasteful if the result is not used?
Stream.prototype.then = function(f) {

    if (this.ended) {
        f(this.value);

        // TODO promise-style behavior where a stream returned by f()
        // gets followed instead, and if it yields a stream, then it's
        // followed, etc.
        // An idea (might work):
        // stream.flatten(Stream s | Object value)?
        // Return a stream that gives 'value' or the result of flattening
        // s's end value.
    }

    this.addEndListener(f);
};

test('then()', function() {
    var s = stream();
    var ended = 0;
    s.then(function() {
        ended++;
    });
    test('listener not called if stream had not ended when calling .then');
    assert(ended === 0);

    var s2 = stream();
    s2.end();
    s2.then(function() {
        ended++;
    });
    test('listener is called if stream had ended when calling .then');
    assert(ended === 1);
    ended = 0;

    s.end();
    test('listener is called when .end() is called on stream');
    assert(ended === 1);
});

// Called internally by then().
// The list of end listeners is initialized lazily, as end listeners are not
// expected to be as common as value listeners.
Stream.prototype.addEndListener = function(f) {
    if (!this.endListeners) {
        this.endListeners = [];
    }
    this.endListeners.push(f);
};


// Stream.end(optional value)
//
// End a stream, optionally giving it a value first.
//
// TODO can only source streams be .end()ed?
// Can ended streams drop their children without telling them?
// Would that be of any use?
Stream.prototype.end = function(value) {
    if (arguments.length) {
        this.set(value);
    }
    (this.endListeners || []).forEach(function(f) {
        f(this.value);
    }, this);

    this.ended = true;

    // Clear the listeners list
    stream.listeners = [];
};

// Called internally by catch().
// The list of error listeners is initialized lazily, as error listeners are
// not expected to be as common as value listeners.
Stream.prototype.addErrorListener = function(f) {
    if (!this.errorListeners) {
        this.errorListeners = [];
    }
    this.errorListeners.push(f);
};

// Stream.error(Function f)
//
// Call f(error) if a stream throws an error.
//
// If the stream already has an error, f is called immediately with it.
Stream.prototype.catch = function(f) {
    if (this.error) {
        f(this.error);
    }
    this.addErrorListener(f);
};

test('catch()', function() {
    var s = stream();
    s.throw(new Error('hello'));

    var caught = 0;
    s.catch(function() {
        caught++;
    });

    assert.eq(caught, 1);
});

Stream.prototype.throw = function(error) {
    if (this.error) {
        throw new Error('throw([Error: ' + error.message + ']): cannot throw ' +
        'twice (old error: [Error: ' + this.error.message + ']');
    }

    this.error = error;

    (this.errorListeners || []).forEach(function(f) {
        // TODO
        f(error);
    });

    // A potential implementation:
    // let the error propagate to all of this stream's descendants
    // (in topological order)
    // any handler can stop the error propagation (by returning something?)
    // (or maybe not)
    // By default, the streams are left into 'failed' state (== .error set)
    // (Maybe?) uncaught exceptions will be thrown at the end
    // to allow then() chains as with promises
    // (Should we prevent .set() for streams that have an error?)
};


// Chapter 2 - Stream utilities.
// Functions that create new streams or help creating them.

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

// Make a stream from a promise.
stream.fromPromise = function(promise) {
    var result = stream();

    promise.then(function(value) {
        result.set(value);
    }).fail(function(error) {
        result.throw(error);
    });

    return result;
};

stream.fromCallback = function(f) {
    assert(typeof f === 'function');
    assert(arguments.length <= 1);

    var result = stream();

    f(function(value) {
        result.set(value);
    });

    return result;
};

stream.fromNodeCallback = function(f) {
    assert(typeof f === 'function');
    assert(arguments.length <= 1);

    var result = stream();
    f(function(err, value) {
        assert(!err);
        result.set(value);
    });

    return result;
};

// TODO replace with .sample()
stream.fromPoll = function(interval, f) {
    var result = stream();

    setInterval(function() {
        result.set(f());
    }, interval);

    return result;
};

var defer = typeof setImmediate === 'function' ? setImmediate : setTimeout;

// Produce a stream that yields the elements of array as fast as it can.
stream.fromArray = function(array) {
    var result = stream();

    var index = 0;
    function takeNext() {
        if (index === array.length) {
            result.end();
            return;
        }
        result.set(array[index++]);
        defer(takeNext);
    }

    takeNext();

    return result;
};

stream.fromBinder = function(f) {
    var result = stream();

    function sink(value) {
        result.set(value);
    }

    f(sink);

    return result;
};

stream.interval = function(interval, value) {
    return stream.repeatedly(interval, [value]);
};

stream.sequentially = function(interval, values) {
    var result = stream();

    var idx = 0;
    var intervalId = setInterval(function() {
        if (idx >= values.length) {
            clearInterval(intervalId);
        } else {
            result.set(values[idx++]);
        }
    }, interval);

    return result;
};

stream.repeatedly = function(interval, values) {
    assert(values.length);

    var result = stream();

    var idx = 0;
    setInterval(function() {
        while (idx >= values.length) {
            idx -= values.length;
        }
        result.set(values[idx++]);
    }, interval);

    return result;
};

stream.never = function() {
    return stream();
};

stream.later = function(delay, value) {
    var result = stream();

    setTimeout(function() {
        result.set(value);
    }, delay);

    return result;
};

// TODO bacon compatibility: new Bacon.EventStream(subscribe)

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

// Create a stream that depends on this stream, install an update handler
// on it and calls it if this stream has a value.  This should be used
// by most stream operators that take a single parent stream, such as
// map, filter, uniq, etc.
//
// 'update' is a function that receives the parents of the resulting stream
// when one of them has changed.  It should call this.newValue(value) if it
// wants to update the resulting stream.
//
// 'options' contains any properties that you want to set on the resulting
// stream, such as 'f', 'state', or whatever you like.
//
// If you want to set the initial value of the resulting stream, you should
// do that after you call derive().  Otherwise the initial update() call
// will overwrite it.
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

// 123 -> function() { return 123; }
// 'x' -> function() { return 'x'; }
// '.x' -> function(o) { (typeof o.x === 'function') ? o.x() : o.x; }
//
// I don't like this one bit

function functionFromAnything(anything) {
    if (typeof anything === 'function') {
        return anything;
    }

    if (typeof anything === 'string' && anything[0] === '.') {
        var prop = anything.slice(1);
        return function(o) {
            return typeof o[prop] === 'function' ? o[prop]() : o[prop];
        };
    }

    return function() {
        return anything;
    }
}

// TODO map(Stream s) -> s.sampledBy(this)?

// A stream whose value is updated with 'f(x)' whenever this
// stream's value is updated with 'x'.
//
// var s2 = s1.map(function(value) { return value + 1; });
//
// s1: 1 1 2 2 5 6 6
// s2: 2 2 3 3 6 7 7
Stream.prototype.map = function(f) {
    return stream({
        parents: [ this ],
        update: function mapUpdate(parent) {
            this.newValue(this.f(parent.value));
        },
        f: functionFromAnything(f)
    });
};

// TODO when errors come... what's this anyway?
//Stream.prototype.mapError = function(f) {
//
//}

// TODO Stream.prototype.errors
// TODO Stream.prototype.skipErrors
// TODO Stream.prototype.mapEnd (what's this? why?)

// Return a stream whose value is updated with 'x' whenever this
// stream's value is updated with 'x', if 'f(x)' is true.
//
// var s2 = s1.filter(isOdd);
//
// s1: 1 1 2 2 5 6 6
// s2: 1 1     5
Stream.prototype.filter = function(f) {
    // TODO filter(Stream s)
    // filter while s.value is true
    return stream({
        parents: [ this ],
        update: function filterUpdate(parent) {
            if (this.f(parent.value)) {
                this.newValue(parent.value);
            }
        },
        f: functionFromAnything(f)
    });
};

// Return a stream that follows its parent's values, but only updates
// when the value changes.  Similar to the UNIX tool uniq(1).
//
// var s2 = s1.uniq()
//
// s1: 1 1 2 2 5 6 6
// s2: 1   2   5 6
Stream.prototype.uniq = function() {
    return stream({
        parents: [ this ],
        update: function uniqUpdate(parent) {
            if (parent.value !== this.value) {
                this.newValue(parent.value);
            }
        }
    });
};

Stream.prototype.combine = function(other, f) {
    return stream({
        parents: [ this, other ],
        update: function combineUpdate(parent1, parent2) {
            this.newValue(this.f(parent1.value, parent2.value));
        },
        f: f
    });
};

Stream.prototype.sampledBy = function(other) {
    return stream({
        parents: [ this, other ],
        update: function sampledByUpdate(source, sampler) {
            if (sampler.wasChanged()) {
                this.newValue(source.value);
            }
        }
    });
};

// TODO this belongs with .take()
// Do a transformation to it, similar to how filter() must do
// when it's given a function. (change it to this.map(f))
// Like bacon's takeWhile(property), I assume; note that takeWhile
// does not produce new values if other's value (only) changes.
Stream.prototype.takeWhile = function(other) {

    // TODO does not work really - actual takeWhile ends the stream
    // once the other one produces false.
    function takeWhileFunctionUpdate(source) {
        // Umm... should other() be given 'source' as argument?
        // Should it be put through functionFromAnything?
        if (other()) {
            this.newValue(source.value);
        }
    }

    if (typeof other === 'function') {
        return stream({
            parents: [ this ],
            update: takeWhileFunctionUpdate
        });
    }

    function takeWhileUpdate(source, sampler) {
        if (source.wasChanged() && sampler.value) {
            this.newValue(source.value);
        }
    }

    return stream({
        parents: [ this, other ],
        update: takeWhileUpdate
    });
};

// TODO delay, throttle, debounce,
// debounceImmediately?


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

    return stream({
        parents: [ this, other ],
        update: mergeUpdate
    });
};

// TODO make this work on a stream that already has value
// like bacon's property scan already does
// TODO make this work without an initial value
// TODO and the previous cases combined
// like .reduce() would work, presumably.
// Like in the previous stream library incarnation, if I recall correctly
Stream.prototype.scan = function(initial, f) {
    return stream({
        parents: [ this ],
        update: function scanUpdate(parent) {
            this.newValue(this.f(this.value, parent.value));
        },
        value: initial,
        f: f
    });
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

    return stream({
        parents: [ this ],
        update: slidingWindowUpdate,
        value: [],
        n: n
    });
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

    return stream({
        parents: [ this ],
        update: slidingWindowByUpdate,
        value: []
    });
};

Stream.prototype.take = function(n) {
    function takeUpdate(parent) {
        if (this.n > 0) {
            this.newValue(parent.value);
            this.n--;
        }
    }

    return stream({
        parents: [ this ],
        update: takeUpdate,
        n: n
    });
};

// Stream.when(window.fetch('data.json'))
//     .map(JSON.parse)
//     .filter(".hasSomeProperty")
//     .catch(function(err)) {
//         // TODO could return a stream, or a like then handlers
//     })

// // Alternatively, you could have stream constructor like
// stream(parent, /* optional */ update, /* ... */)
// stream(window.fetch('data.json'))
//     .then(function() ... )

Stream.prototype.when = function(thenable) {
    // Converts a thenable into a stream

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

    return stream({
        parents: [ this ],
        update: flatMapUpdate,
        f: f
    });
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

    return stream({
        parents: [ this ],
        update: flatMapLatestUpdate
    });
};

function identityUpdate(parent) {
    this.newValue(parent.value);
}

// Now what's the purpose of this, I don't know
Stream.prototype.toProperty = function(initial) {
    return stream({
        parents: [ this ],
        update: identityUpdate
    }).set(initial);
};

// Just skip the initial value, if any.
Stream.prototype.changes = function() {
    return stream({
        parents: [ this ],
        update: identityUpdate
    }).set(undefined);
};

// Ha ha
Stream.prototype.toEventStream = function() {
    return stream({
        parents: [ this ],
        update: identityUpdate
    });
    // Contrast the one above with this one. We can do better.
    // return stream(this, identityUpdate)?
    // return stream(identityUpdate, this)?
//    return this.derive(identityUpdate);
};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = stream;
}
