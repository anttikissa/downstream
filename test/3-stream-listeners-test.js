test('3-stream-callbacks-test.js', function() {
    test('Stream::addCallback() and Stream::removeCallback()', function() {
        var s = stream();
        function f() {}
        function f2() {}
        test('callbacks can be added many times');
        s.addCallback(f);
        s.addCallback(f);
        assert(s.callbacks.length === 2);
        s.addCallback(f2);
        s.addCallback(f);

        assert(s.callbacks.length === 4);

        test('removeCallback(f) can be called as many times as addCallback(f)');
        s.removeCallback(f);
        assert(s.callbacks.length === 3);
        s.removeCallback(f);
        assert(s.callbacks.length === 2);
        s.removeCallback(f);
        assert(s.callbacks.length === 1);
        test('removeCallback(f) has no effect is f was not added as a listener');
        s.removeCallback(f);
        assert(s.callbacks.length === 1);
    });

    test('Stream::addEndCallback() and Stream::removeEndCallback', function() {
        var s = stream();

        assert.is(s.endCallbacks, undefined);

        var x = function x() {};
        s.addEndCallback(x);

        assert.is(s.endCallbacks.length, 1);
        assert.is(s.endCallbacks[0], x);

        s.removeEndCallback(x);
        assert.eq(s.endCallbacks, []);
    });

    test('Stream::done()', function() {
        test('on an ended stream', function(done) {
            var s = stream().end(1);
            s.done(done);
        });

        test('callback is called when the stream ends', function(done) {
            var s = stream();
            s.done(done);
            assert.is(done.callCount, 0);
            s.end();
            assert.is(done.callCount, 1);
            s.end();
        });
    });


    test('Stream::then()', function() {
        test('on an ended stream', function(done) {
            var s = stream().end();
            s.then(done);
        });

        test('callback is called when the stream ends', function(done) {
            var s = stream();
            s.then(done);
            s.end();
        });

        test('the result sees the stream returned by callback', function() {
            var s = stream();
            var s2 = stream().set(1);

            var result = s.then(function(finalValue) {
                return s2.set(finalValue * 10);
            });

            s.end(2);
            assert.is(result.value, 20);

            assert(!result.hasEnded());
            s2.end();
            assert(result.hasEnded());
        });
    })
});
