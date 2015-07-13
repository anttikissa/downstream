test('5-generators-test.js', function() {
    test('stream.from()', function() {
        var numbers = stream.from([1, 2, 3]);
        assert.is(numbers.value, undefined);

        test('subsequent tick()s produce values');
        numbers.tick();
        assert.is(numbers.value, 1);
        numbers.tick();
        assert.is(numbers.value, 2);
        numbers.tick();
        assert.is(numbers.value, 3);

        test('after the last value, tick() ends the stream');
        assert(!numbers.hasEnded());
        numbers.tick();
        assert(numbers.hasEnded());

        test('tick() is safe to call (but no-op) after the stream has ended');
        numbers.tick();
        assert(numbers.hasEnded());
    });
});
