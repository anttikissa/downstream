var events = require('events');
var EventEmitter = events.EventEmitter;
var stream = require('./stream');

function log() {
    console.log.apply(console, arguments);
}

function assert(what) {
    if (!what) {
        throw new Error('not true: ' + what);
    }
}

function test(what, f) {
    if (!f) {
        f = what;
        what = f.name;
    }
    if (what) {
        log('Testing', what);
    }
    f();
}

// Assertion check for deep equality.
assert.eq = function(x, y) {
    if (JSON.stringify(x) !== JSON.stringify(y)) {
        throw new Error('Got ' + JSON.stringify(x) + ', expected ' + JSON.stringify(y));
    }
};

test('stream.fromEventTarget with EventEmitter', function() {
    var e = new EventEmitter();
    var foos = stream.fromEventTarget(e, 'foo');
    var bars = stream.fromEventTarget(e, 'bar');

    e.emit('foo', 1);

    assert.eq(foos.value, 1);

    e.emit('bar', 2);

    assert.eq(bars.value, 2);;
});