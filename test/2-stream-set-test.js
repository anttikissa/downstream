test('2-stream-set-test.js', function() {
    test('Stream::set()', function() {
        test('sets the value', function() {
            var s = stream();
            s.set(123);
            assert.is(s.value, 123);
        });

        test('sets the version', function() {
            var s = stream();
            s.set(123);
            assert(s.version > 0);
        });

        test('updates the version', function() {
            var s = stream();
            s.set(123);
            var oldVersion = s.version;
            s.set(234);
            assert(s.version > oldVersion);
        });

        test('fails if stream not active', function() {
            var s = stream();
            s.end();

            assert.throws(function() {
                s.set(123);
            }, "stream is in state 'ended', should be 'active'");
        });

        test('fails if stream not a source stream', function() {
            var s = stream();
            var s2 = s.map(function() { return 1; });
            assert.throws(function() {
                s2.set(2);
            }, 'stream is not a source stream');
        });
    });

    // TODO test updateOrder

    test('Stream::end()', function() {
        test('returns the stream', function() {
            var s = stream();
            assert.is(s.end(), s);
        });

        test('sets the stream to ended state', function() {
            var s = stream();

            assert.is(s.state, 'active');
            assert(!s.hasEnded());
            s.end();
            assert.is(s.state, 'ended');
            assert(s.hasEnded());
        });

        test('can be called twice, but end listener is only called once', function() {
            var s = stream();
            var doneCalled = 0;
            s.done(function() {
                doneCalled++;
            });
            assert.is(doneCalled, 0);
            s.end();
            assert.is(doneCalled, 1);
            s.end();
            assert.is(doneCalled, 1);
        });
    });

    test('Adding an ended stream as a parent', function() {
        function combine(s1, s2) {
            return stream([s1, s2], {
                update: function(s1, s2) {
                    this.newValue(s1.value + s2.value);
                }
            });
        }

        var s1 = stream().set(1);
        var s2 = stream().set(2);
        s2.end();

        var result = combine(s1, s2);
        assert.is(result.parents[0], s1);
        assert.is(result.parents[1], s2);

        assert.is(s1.children.length, 1);
        test('the ended stream should not have adopted children');
        assert.is(s2.children.length, 0);
    })
});
