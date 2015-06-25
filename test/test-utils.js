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
var depth = 0;

var failed = false;

function test(what, f) {
    if (failed) {
        return;
    }
    log(Array(depth + 1).join('| ') + what);
    depth++;
    if (f) {
        f();
    }
    depth--;
}

function isNaNReally(value) {
    return typeof value === 'number' && isNaN(value);
}

// A (slightly) better JSON.stringify for accurate error reportage.
function describe(value) {
    if (isNaNReally(value)) {
        return "NaN";
    }
    return JSON.stringify(value);
}

// Print out relevant information about the error.
function report(error) {
    console.error(error.message);
    console.error(error.stack.split('\n').slice(2, 5).join('\n'));
    failed = true;
    // throw error;
}

// Assertion check for equality.
assert.is = function(x, y) {
    if (x !== y) {
        report(new Error('Got ' + describe(x) + ', expected ' + describe(y)));
    }
};

// Assertion check for deep equality.
assert.eq = function(x, y) {
    if (describe(x) !== describe(y)) {
        report(new Error('Got ' + describe(x) + ', expected ' + describe(y)));
    }
};

assert.fail = function() {
    report(new Error('Should not be here'));
};

// Assert that `f` throws an error with message `message`.
assert.throws = function(f, message) {
    try {
        f();
        report(new Error("Function didn't throw, expected '" + message + "'"));
    } catch (err) {
        if (err.message !== message) {
            report(new Error('Function threw with message "' + err.message
                + '", expected "' + message + '"'))
        }
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
