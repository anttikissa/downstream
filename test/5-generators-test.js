test('5-generators-test.js', function() {
    test('stream.from()', function() {
        test('with array containing values', function() {
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

        test('disposes references to array data after iterating', function() {
            var marker = 123454321;
            var numbers = stream.from([marker, 2]);

            function contains(string, substring) {
                return string.indexOf(substring) >= 0;
            }

            assert(contains(JSON.stringify(numbers), marker));
            numbers.tick();
            assert.is(numbers.value, marker);
            numbers.tick();
            assert(!contains(JSON.stringify(numbers), marker));
        });

        test('with an empty array', function() {
            var empty = stream.from([]);
            assert(!empty.hasEnded());
            empty.tick();
            assert(empty.hasEnded());
        });

        test('with a string', function() {
            var letters = stream.from('abc');

            test('subsequent tick()s produce values');
            letters.tick();
            assert.is(letters.value, 'a');
            letters.tick();
            assert.is(letters.value, 'b');
            letters.tick();
            assert.is(letters.value, 'c');

            test('and the last tick() ends the stream');
            letters.tick();
            assert(letters.hasEnded());
        });
    });
});
