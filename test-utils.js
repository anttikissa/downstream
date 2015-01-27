function log() {
    console.log.apply(console, arguments);
}

function assert(what) {
    if (!what) {
        throw new Error('not true: ' + what);
    }
}

function defer(f) {
    setTimeout(f, 1);
}

// Allows tests with the syntax
// test('description of test', function() { /* code to be run */ });
// and also 'markers' that simply print out what part of the test is being
// run next:
// test('something()', function() {
//   test('something() with no args');
//   something();
//   ... assert something
//   test('something() with odd numbers');
//   something(1);
//   something(3);
//   something(7);
// });
function test(what, f) {
    if (f) {
        defer(function() {
            log(what);
            f();
        });
    } else {
        log('  ' + what);
    }
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
