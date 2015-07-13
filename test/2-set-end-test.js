test('2-set-end-test.js', function() {
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
    // and possibly something else

    test('Stream::newValue()', function() {
        var s = stream();
        assert.is(s.value, undefined);
        assert.is(s.version, 0);

        s.newValue(1);
        assert.is(s.value, 1);
        assert.is(s.version, stream.version);
    });

    test('Stream::newValueFrom()', function() {
        var s = stream().set(1);
        var s2 = stream();

        assert.is(s2.value, undefined);
        assert.is(s2.version, 0);
        s2.newValueFrom(s);

        assert.is(s2.value, 1);
        assert.is(s2.version, stream.version);
    });

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
    });
});
