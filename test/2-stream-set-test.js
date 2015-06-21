test('2-stream-set-test.js', function() {
    test('Stream::set()', function() {
        var s = stream();
        s.set(123);
        // TODO jatka
        assert.is(s.value, 123);
    });
});
