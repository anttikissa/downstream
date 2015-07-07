test('3-stream-listeners-test.js', function() {
    test('Stream::addListener() and Stream::removeListener()', function() {
        var s = stream();
        function f() {}
        function f2() {}
        test('listeners can be added many times');
        s.addListener(f);
        s.addListener(f);
        assert(s.listeners.length === 2);
        s.addListener(f2);
        s.addListener(f);

        assert(s.listeners.length === 4);

        test('removeListener(f) can be called as many times as addListener(f)');
        s.removeListener(f);
        assert(s.listeners.length === 3);
        s.removeListener(f);
        assert(s.listeners.length === 2);
        s.removeListener(f);
        assert(s.listeners.length === 1);
        test('removeListener(f) has no effect is f was not added as a listener');
        s.removeListener(f);
        assert(s.listeners.length === 1);
    });

    test('Stream::addEndListener() and Stream::removeEndListener', function() {
        var s = stream();

        assert.is(s.endListeners, undefined);

        var x = function x() {};
        s.addEndListener(x);

        assert.is(s.endListeners.length, 1);
        assert.is(s.endListeners[0], x);

        s.removeEndListener(x);
        assert.eq(s.endListeners, []);
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
            s.done(done);
        });

        test('')
    })
});
