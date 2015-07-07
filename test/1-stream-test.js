test('1-stream-test.js', function() {
    test('stream()', function() {
        test('basic functionality', function() {
            var s = stream();
            assert.is(s.value, undefined);
            assert.is(s.version, 0);
            assert.eq(s.parents, []);
            assert.eq(s.children, []);
        });
    });

    test('Stream::update() when not overridden', function() {
        var parent = stream();
        var child = stream();
        // Manually forge a parent-child relationship
        child.parents.push(parent);
        parent.children.push(child);

        assert.throws(function() {
            parent.set(1);
        }, 'Stream does not define update()');
    });

    test('Adding ended streams as parents', function() {
        // Stream that is sum of the most recent values of its parent streams
        // Similar to stream.combine(function(x, y) { x + y}, ...) but only
        // exercises the relevant parts of the code base.
        function sum(s1, s2) {
            return stream([s1, s2], {
                update: function(s1, s2) {
                    this.newValue(s1.value + s2.value);
                }
            });
        }

        test('one of the parents has ended', function() {
            var s1 = stream().set(1);
            var s2 = stream().set(2);
            s2.end();

            var result = sum(s1, s2);
            assert.is(result.parents[0], s1);
            assert.is(result.parents[1], s2);

            assert.is(s1.children.length, 1);
            test('the ended stream should not have adopted children');
            assert.is(s2.children.length, 0);
        });
    });


    test('Stream::log()', function() {
        var oldConsoleLog;

        // This assumes that console.log can be changed, which is the case at
        // least in Chrome.
        function saveLog() {
            oldConsoleLog = console.log;
            var log = [];
            console.log = function() {
                log.push([].slice.apply(arguments));
            };
            return log;
        }

        function restoreLog() {
            console.log = oldConsoleLog;
        }

        test('without prefix', function() {
            var log = saveLog();

            try {
                s = stream().set(1);
                s.log();
                s.set(2);
                assert.eq(log, [[1], [2]]);
            } finally {
                restoreLog();
            }
        });

        test('with prefix', function() {
            var log = saveLog();

            try {
                s = stream().set(1);
                s.log('with a prefix');
                s.set(2);
                assert.eq(log, [['with a prefix', 1], ['with a prefix', 2]]);
            } finally {
                restoreLog();
            }
        });

        test('two loggers', function() {
            var log = saveLog();

            try {
                s = stream();
                s.log('first');
                s.log('second');
                assert.is(s.listeners.length, 2);
                s.set(2);
                assert.eq(log, [['first', 2], ['second', 2]]);
            } finally {
                restoreLog();
            }
        });
    });

    test('error messages when passing in a non-stream parent', function() {
        assert.throws(function() {
            stream(1);
        }, 'parent 1 is not a Stream');
    });
});
