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
});
