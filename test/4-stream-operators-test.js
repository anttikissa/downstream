test('4-stream-operators-test.js', function() {
    function inc(x) {
        return x + 1;
    }

    function plus(x, y) {
        return x + y;
    }

    function plusThree(x, y, z) {
        return x + y + z;
    }

    function isOdd(x) {
        return x % 2 !== 0;
    }

    test('Stream::map()', function() {
        test('without initial value', function() {
            var s = stream();
            var s2 = s.map(inc);

            assert.is(s2.value, undefined);
            s.set(1);
            assert.is(s2.value, 2);
        });

        test('with initial value', function() {
            var s = stream().set(1);
            var s2 = s.map(inc);

            assert.is(s2.value, 2);
        });

        test('ends when parent ends', function() {
            var s = stream().set(1);
            var s2 = s.map(inc);

            assert(!s2.hasEnded());
            s.end();
            assert(s2.hasEnded());
        });
    });

    test('Stream::filter()', function() {
        test('without initial value', function() {
            var s = stream();
            var s2 = s.filter(isOdd);

            s.set(1);
            assert.is(s2.value, 1);
            s.set(2);
            assert.is(s2.value, 1);
            s.set(3);
            assert.is(s2.value, 3);
        });

        test('with initial value', function() {
            var s = stream().set(1);
            var s2 = s.filter(isOdd);

            assert.is(s2.value, 1);
        });

        test('ends when parent ends', function() {
            var s = stream().set(1);
            var s2 = s.filter(isOdd);
            s.end();

            assert(s2.hasEnded());
        });
    });

    test('Stream::uniq()', function() {
        var s = stream().set(1);
        sUniq = s.uniq();
        test('initial value');
        assert.is(sUniq.value, 1);

        var values = [];
        sUniq.forEach(function(value) { values.push(value); });

        s.set(1).set(2).set(2).set(5).set(6).set(6);
        assert.eq(values, [1, 2, 5, 6]);

        test('ends when parent ends');
        s.end();
        assert(sUniq.hasEnded());
    });

    test('Combining map, filter, and uniq', function() {
        var numbers = stream();
        var letters = numbers.map(function(value) {
            return String.fromCharCode(value + 64);
        });
        var consonants = letters.filter(function(letter) {
            return !'AEIOUY'.includes(letter);
        });
        var uniqueConsonants = consonants.uniq();

        var lettersResult = '';
        letters.forEach(function(letter) { lettersResult += letter; });
        var consonantsResult = '';
        consonants.forEach(function(consonant) { consonantsResult += consonant; });
        var uniquesResult = '';
        uniqueConsonants.forEach(function(unique) { uniquesResult += unique; });

        [8, 5, 12, 12, 15, 23, 15, 18, 12, 4].forEach(function(number) {
            numbers.set(number);
        });

        assert.is(lettersResult, 'HELLOWORLD');
        assert.is(consonantsResult, 'HLLWRLD');
        assert.is(uniquesResult, 'HLWRLD');

        test('all derived streams end at the same time', function() {
            numbers.end();
            assert(letters.hasEnded());
            assert(consonants.hasEnded());
            assert(uniqueConsonants.hasEnded());
        });
    });

    test('stream.reduce()', function() {

        test('without initial value in the source stream', function() {
            var numbers = stream();

            var sum = numbers.reduce(plus);

            assert.is(sum.value, undefined);

            numbers.set(1);
            assert.is(sum.value, 1);

            numbers.set(2);
            assert.is(sum.value, 3);

            numbers.set(3);
            assert.is(sum.value, 6);
        });

        test('with initial value in the source stream', function() {
            var numbers = stream().set(10);

            var sum = numbers.reduce(plus);

            assert.is(sum.value, 10);

            numbers.set(1);
            assert.is(sum.value, 11);

            numbers.set(2);
            assert.is(sum.value, 13);
        });

        test('ends when the parent ends', function() {
            var numbers = stream().set(1);
            var sum = numbers.reduce(plus);

            numbers.set(2);
            numbers.end();
            assert(sum.hasEnded());
        });

        test('computing sum of all values with .done()', function() {
            var numbers = stream();
            var sum = numbers.reduce(plus);

            var done = false;
            sum.done(function(result) {
                assert.is(result, 6);
                done = true;
            });

            numbers.set(1);
            numbers.set(2);
            numbers.set(3);
            numbers.end();

            assert(done);
        });
    });

    test('stream.reduce(initial)', function() {

        test('without initial value in the source stream', function() {
            var values = stream();

            var collected = values.reduce(function(result, value) {
                return result.concat(value);
            }, []);

            var listenerCalled = 0;
            collected.forEach(function() {
                listenerCalled++;
            });

            test('listener gets called once with the initial value')
            assert.is(listenerCalled, 1);
            assert.eq(collected.value, []);

            values.set('hello');
            assert.eq(collected.value, ['hello']);
            values.set('world');
            assert.eq(collected.value, ['hello', 'world']);
        });

    });

    test('stream.combine()', function() {
        test('with two sources', function() {
            var odds = stream().set(1);
            var evens = stream().set(2);

            var sums = stream.combine(plus, odds, evens);
            assert.is(sums.value, 3);
        });

        test('with three sources', function() {
            var ones = stream().set(1);
            var twos = stream().set(2);
            var threes = stream().set(3);

            var sums = stream.combine(plusThree, ones, twos, threes);
            assert.is(sums.value, 6);

            ones.set(11);
            assert.is(sums.value, 16);

            twos.set(22);
            assert.is(sums.value, 36);

            threes.set(33);
            assert.is(sums.value, 66);
        });

        // A lesser-used combination because stream.map() does the same.
        test('with one source', function() {
            var s = stream().set(1);
            var s2 = stream.combine(inc, s);
            assert.is(s2.value, 2);
        });

        // A pointless operation - f will never be called and the stream never
        // updates because it has no parents to trigger an update. But there's no
        // reason not to implement it.
        test('with zero sources', function() {
            var s = stream.combine(function() { return 123; });
            assert.is(s.value, undefined);
        });

        test('combining mapped streams', function() {
            var source = stream();

            source.set(1);

            var s1 = source.map(function(x) { return x * 10; });
            var s2 = source.map(function(x) { return x * 100; });

            var s3 = stream.combine(function(x, y) { return x + y; }, s1, s2);

            assert.is(s3.value, 110);

            var values = [];
            s3.forEach(function(value) {
                values.push(value);
            });

            assert.eq(values, [110]);

            source.set(2);

            assert.is(s3.value, 220);
            assert.eq(values, [110, 220]);
        });

        test('end() works properly with diamond-like dependency structure', function() {
            // TODO
        });
    });

    test('error messages when passing in a non-function', function() {
        test('map, reduce, filter', function() {
            ['map', 'reduce', 'filter'].forEach(function(method) {
                var s = stream();
                assert.throws(function() {
                    s[method]('not-a-function');
                }, 'f (not-a-function) is not a function');
            });
        });

        test('stream.combine()', function() {
            assert.throws(function() {
                stream.combine('not-a-function');
            }, 'f (not-a-function) is not a function');
        });
    });
});
