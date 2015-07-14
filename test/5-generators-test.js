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

        test('run()', function() {
            var s = stream.from([1,2,3]);
            var forEachCalled = 0;
            s.forEach(function(value) {
                assert(1 <= value && value <= 3);
                forEachCalled++;
            });

            var doneCalled = 0;
            s.done(function(value) {
                assert.is(value, 3);
                doneCalled++;
            });

            s.run();
            assert.is(forEachCalled, 3);
            assert.is(doneCalled, 1);
            assert(s.hasEnded());
            assert.is(s.value, 3);
        });
    });

    test('stream.range()', function() {
        test('finite range', function(done) {
            var range = stream.range(1, 5);

            range.collect().then(function(values) {
                assert.eq(values, [1, 2, 3, 4, 5]);
                done();
            });

            range.run();
        });

        test('range with non-matching end value', function(done) {
            var range = stream.range(3, Math.PI, 0.04);

            range.collect().then(function(values) {
                assert.eq(values, [3, 3.04, 3.08, 3.12]);
                done();
            });

            range.run();
        });

        test('infinite range', function() {
            var range = stream.range(100);

            range.tick();
            assert.is(range.value, 100);

            range.tick();
            assert.is(range.value, 101);

            range.tick();
            assert(!range.hasEnded());
        });

        test('range with negative step', function() {
            var range = stream.range(10, 6, -2);
            range.tick();
            assert.is(range.value, 10);
            range.tick();
            assert.is(range.value, 8);
            range.tick();
            assert.is(range.value, 6);
            range.tick();
            assert.is(range.value, 6);
            assert(range.hasEnded());
        });
    });
});
