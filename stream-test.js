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

test('stream', function() {
    if (typeof stream !== 'function') {
        throw new Error('fail');
    }

    var s = stream(1);
    assert(s.value === 1);
});

test('onValue', function() {
    var s = stream(1);

    var value;

    s.onValue(function(val) {
        value = val;
    });

    assert(value === 1);

    var value2;

    s.onValue(function(val) {
        value2 = val;
    });

    assert(value === 1 && value2 === 1);

    s.set(2);
    assert(value === 2 && value2 === 2);
});

assert.eq = function(x, y) {
    if (JSON.stringify(x) !== JSON.stringify(y)) {
        throw new Error('Got ' + JSON.stringify(x) + ', expected ' + JSON.stringify(y));
    }
};

assert.streamGetsValues = function(stream, values) {
    var result = [];
    stream.onValue(function(value) {
        result.push(value);
    });

    setTimeout(function() {
        assert.eq(result, values);
    });
};

test('filter', function() {
    var s = stream();
    var s2 = s.filter(function(x) { return x % 2; });
    assert.streamGetsValues(s2, [ 1, 3, 5 ]);

    s.set(1).set(2).set(3).set(4).set(5);
});

test('take', function() {
    var s = stream();
    var s2 = s.take(5);
    assert.streamGetsValues(s2, [ 1, 2, 3, 4, 5 ]);

    s.set(1).set(2).set(3).set(4).set(5).set(6).set(7);
});

test('flatMap TODO not real test', function() {

    var s = stream();

    s.flatMap(function (n) {
        var result = stream(n);
        setTimeout(function () {
            result.set(n + 1);
        }, 1000);
        return result;
    });

    // TODO better test

    s.set(5);
    setTimeout(function() { s.set(10); }, 100);
    setTimeout(function() { s.set(15); }, 200);
    setTimeout(function() { s.set(20); }, 300);

});

function inc(x) { return x + 1; }

test('glitch-freeness', function() {
    var s = stream(10);

    var t1 = s.map(inc);
    var t2 = s.map(inc);

    var u = t1.combine(t2, Array);

    assert.streamGetsValues(u, [ [ 11, 11 ], [ 21, 21 ] ]);

    s.set(20);
});
