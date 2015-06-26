test('2-stream-set-test.js', function() {
    test('Stream::set()', function() {
        test('sets the value', function() {
            var s = stream();
            s.set(123);
            assert.is(s.value, 123);
        });

        test('fails if stream not active', function() {
            var s = stream();
            s.end();

            assert.throws(function() {
                s.set(123);
            }, "stream is in state 'ended', should be 'active'");
        });
    });

    // TODO updateOrder etc.

    test('Stream::end()', function() {
        test('sets the stream to ended state', function() {
            var s = stream();

            assert.is(s.state, 'active');
            assert(!s.hasEnded());
            s.end();
            assert.is(s.state, 'ended');
            assert(s.hasEnded());
        });

        test('fail if stream not active', function() {
            var s = stream();
            s.end();

            assert.throws(function() {
                s.end();
            }, "stream is in state 'ended', should be 'active'");
        });
    });
});
