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

// Helper to check that stream eventually gets values of 'values' in that order.
// TODO stack trace won't reveal the source of the error but at least you get something.
assert.streamGetsValues = function(stream, values) {
    var result = [];
    stream.onValue(function(value) {
        result.push(value);
    });

    setTimeout(function() {
        assert.eq(result, values);
    }, 1);
};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        log: log,
        assert: assert,
        test: test
    };
}
