function log() {
    console.log.apply(console, arguments);
}

function defer(f) {
    setTimeout(f, 1);
}

var depth = 0;

var failed = false;

var idx = 0;
var successful = 0;

var topLevelTests = [];

var testsStarted = false;
var usingCoverage = false;

// Allows tests with the syntax
//
//  test('description of test', function() {
//      /* code to be run */
//  });
//
// and also 'markers' that simply print out what part of the test is being
// run next:
//
//  test('something()', function() {
//      test('something() with no args');
//      something();
//      ... assert something
//      test('something() with odd numbers');
//      something(1);
//      something(3);
//      something(7);
//  });
function test(what, f) {
    function doTest() {
        if (failed) {
            return;
        }
        if (!usingCoverage) {
            log(Array(depth + 1).join('| ') + what);
        }
        depth++;
        if (f) {
            try {
                if (usingCoverage) {
                    blanket.onTestStart();
                }
                idx++;
                f();
                successful++;
                if (usingCoverage) {
                    blanket.onTestDone(null, successful);
                }
            } catch (err) {
                failed = true;
                console.error(err);
                if (usingCoverage) {
                    blanket.onTestDone(null, successful);
                }
                throw err;
            }
        }
        depth--;
    }

    if (testsStarted) {
        doTest();
    } else {
        topLevelTests.push(doTest);
    }
}

function runAllTests() {
    topLevelTests.forEach(function(test) {
        test();
        if (usingCoverage) {
            blanket.onTestsDone();
        }
    });
}

blanket.beforeStartTestRunner({
    // This will be run right after `blanket.setupCoverage()`.
    //
    // Might be due to chance. But there's been enough hoop-jumping because of
    // blanket.js, so call it good enough for now.
    callback: function() {
        if (failed) {
            return;
        }
        if (!usingCoverage) {
            throw new Error('usingCoverage must be true');
        }

        console.time('run all tests for code coverage');
        runAllTests();
        console.timeEnd('run all tests for code coverage');
    }
});

// The main entry point for running tests
//
// First runs all tests, and if 100% pass, then run all tests again to collect
// code coverage. The two separate runs are necessary because debugging is not
// really feabible after you've setup the coverage collection.
function testMain() {
    console.log('');
    console.log('STANDARD RUN STARTS HERE');
    console.log('');

    testsStarted = true;
    console.time('run all tests');
    runAllTests();
    console.timeEnd('run all tests');
    if (failed) {
        return;
    }

    console.log('');
    console.log('COVERAGE RUN STARTS HERE');
    console.log('');
    usingCoverage = true;
    blanket.setupCoverage();
}

function isNaNReally(value) {
    return typeof value === 'number' && isNaN(value);
}

// A (slightly) better JSON.stringify for accurate error reportage.
function describe(value) {
    try {
        if (isNaNReally(value)) {
            return "NaN";
        }
        return JSON.stringify(value);
    } catch (err) {
        // Usually we end up here if the value is circular, not much to do:
        return value.toString();
    }
}

// Print out relevant information about the error.
function report(error) {
    console.error(error.message);
    console.error(error.stack.split('\n').slice(2, 5).join('\n'));
    failed = true;
    // throw error;
}

// Assert that `what` is truthy.
function assert(what) {
    if (!what) {
        report(new Error('Not true: ' + what));
    }
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
