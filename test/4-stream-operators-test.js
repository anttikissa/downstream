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

    test('Stream::reduce()', function() {
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

        test('version of reduced stream', function() {
            // These tests illustrate that if the reduced stream starts with an
            // initial value, its version will be the parent's version only
            // if the initial value comes from the parent.
            test('is zero if no value', function() {
                // dug
                var s = stream();
                var s2 = s.reduce(inc);
                assert.is(s2.value, undefined);
                assert.is(s2.version, 0);
            });

            test('is zero if parent has no value', function() {
                var letters = stream();
                var result = letters.reduce(plus, '');
                assert.is(result.value, '');
                assert.is(result.version, 0);
            });

            test('is nonzero if parent has a value', function() {
                var numbers = stream().set(1);
                var result = numbers.reduce(plus);
                assert.is(result.value, 1);
                assert(result.version > 0);
                assert.is(result.version, numbers.version);
            });

            test('is nonzero if parent has value and have initial', function() {
                var numbers = stream().set(1);
                var result = numbers.reduce(plus, 1);
                assert.is(result.value, 2);
                assert(result.version > 0);
                assert.is(result.version, numbers.version);
            });
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

    test('Stream::collect(initial)', function() {
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

    test('Stream::collect()', function() {
        test('numbers', function() {
            var s = stream();
            var s2 = s.collect();

            s.set(1);
            s.set(2);

            assert.eq(s2.value, [1, 2]);

            test('collected stream ends when parent ends', function() {
                var doneCalled = false;
                s2.done(function(finalValue) {
                    assert.eq(finalValue, [1, 2]);
                    doneCalled = true;
                });

                s.end();
                assert(doneCalled);
            });
        });

        // Because a wrongly implemented `.reduce()` might use `Array::concat()`
        // without wrapping the argument in a `[]`. Also test initial value.
        test('arrays', function() {
            var s = stream().set([]);
            var s2 = s.collect();

            assert.eq(s2.value, [[]]);

            s.set([1, 2, 3]);

            assert.eq(s2.value, [[], [1, 2, 3]]);
        })
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

        test('ends when one of parent streams ends', function() {
            var s1 = stream().set(1);
            var s2 = stream().set(2);

            var sum = stream.combine(plus, s1, s2);

            assert.is(sum.value, 3);

            var doneCalled = 0;
            sum.done(function() {
                doneCalled++;
            });
            s2.end();
            assert.is(doneCalled, 1);

            s1.end();
            assert.is(doneCalled, 1);

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
            // TODO it's likely that in fact it does not
        });
    });

    // Now that we have the ammunition (filter, map, and combine), we can finally
    // test that the .version of a newly created stream gets set properly:
    test('stream(parent) sets version properly', function() {
        test('when the stream gets a value when created', function() {
            var parent = stream().set(1);
            var mapped = parent.map(inc);
            assert.is(parent.version, mapped.version);
        });

        test("when the stream doesn't get a value when created", function() {
            var parent = stream().set(2);
            var mapped = parent.filter(isOdd);
            assert(parent.version > 0);
            // Doesn't get a value...
            assert.is(mapped.value, undefined);
            // ...doesn't get a version, either.
            assert.is(mapped.version, 0);
        });

        test('when the stream has multiple parents', function() {
            var parent1 = stream();
            var parent2 = stream();
            var parent3 = stream();

            parent1.set(1);
            parent3.set(3);
            parent2.set(2);
            assert(parent2.version > parent3.version);
            assert(parent3.version > parent1.version);

            var sum = stream.combine(plusThree, parent1, parent2, parent3);
            assert.is(sum.version, parent2.version);
        });
    });

    test('stream.combineWhenAll()', function() {
        test('gets value only after all parents have value', function() {
            var s1 = stream();
            var s2 = stream().set(2);
            var s3 = stream();

            var sum = stream.combineWhenAll(plusThree, s1, s2, s3);
            assert(!sum.hasValue());
            s1.set(1);
            assert(!sum.hasValue());
            s3.set(3);
            assert(sum.hasValue());
            assert.is(sum.value, 6);
        });

        test('ends when one parent stream ends', function() {
            var s1 = stream();
            var s2 = stream().set(1);
            var sum = stream.combineWhenAll(plus, s1, s2);
            assert(!sum.hasEnded());
            s1.end();
            assert(sum.hasEnded());
            assert(!sum.hasValue());
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

    test('Stream::merge()', function() {
        test('with two streams', function() {
            var s = stream();
            var s2 = stream();
            var merged = stream.merge(s, s2);

            s.set(1);
            assert.is(merged.value, 1);

            s2.set(2);
            assert.is(merged.value, 2);
        });

        test('ends only after all sources are done', function() {
            var s = stream().set(1);
            var s2 = stream().set(2);
            var merged = stream.merge(s, s2);

            var mergedEnded = false;

            // Assert that the `done` callback gets called, too
            merged.done(function() {
                mergedEnded = true;
            });

            s.end();
            assert(!merged.hasEnded());
            assert(!mergedEnded);

            s2.end();
            assert(merged.hasEnded());
            assert(mergedEnded);
        });

        test('with three streams', function() {
            var s = stream();
            var s2 = stream();
            var s3 = stream();

            var merged = stream.merge(s, s2, s3);

            var doneCalled = false;
            merged.collect().done(function(values) {
                assert.eq(values, ([1, 2, 3, 4]));
                doneCalled = true;
            });

            s3.set(1);
            s2.set(2);
            s.set(3);
            s2.set(4);
            s.end();
            s2.end();
            s3.end();

            assert(doneCalled);
        });

        test('initial value comes from the newest parent', function() {
            test('normal case', function() {
                var s1 = stream().set(1);
                var s2 = stream().set(2);

                var merged1 = stream.merge(s1, s2);
                assert.is(merged1.value, 2);
            });

            test('the same in another order', function() {
                var s3 = stream().set(3);
                var s4 = stream().set(4);

                var merged2 = stream.merge(s4, s3);
                assert.is(merged2.value, 4);
            });

            test('more complex example with derived streams', function() {
                // This is a contrived example, probably nothing of the like
                // will happen in the real world. But here's a test to document
                // how it happens when it does.
                var s1 = stream().set(1);
                var s2 = stream().set(2);
                // Even though s3 is created later than s2 is set, its version
                // is same as s1.
                var s3 = s1.map(function(x) { return x * 10; });

                assert.is(s1.version, s3.version);

                // Therefore s2 is newer.
                assert(s2.version > s3.version);
                var merged3 = stream.merge(s1, s2, s3);

                // Initial value comes from s2:
                assert.is(merged3.value, 2);

                s1.set(3);

                // Now it comes from s3 since it updates at the same time
                // as s1:
                assert.is(merged3.value, 30);
            });
        });
    });

    // Meta-operators

    test('Stream::flatMap()', function() {
        test('simple case', function() {
            var s = stream();
            var streams = [stream(), stream()];

            var allValues = s.flatMap(function(idx) {
                return streams[idx];
            });

            s.set(0);
            assert.is(allValues.value, undefined);
            streams[0].set(1);
            assert.is(allValues.value, 1);
            s.set(1);
            assert.is(allValues.value, 1);
            streams[1].set(2);
            assert.is(allValues.value, 2);
            streams[0].set(3);
            assert.is(allValues.value, 3);
        });

        test('with f() that returns streams that already have values', function() {
            var s = stream();
            var streams = [stream(), stream(), stream()];

            streams[0].set(1);
            streams[2].set(3);
            streams[1].set(2);

            var allValues = s.flatMap(function(idx) {
                return streams[idx];
            });

            s.set(0);
            assert.is(allValues.value, 1);

            s.set(1);
            assert.is(allValues.value, 2);

            s.set(2);
            test('the new stream has an older value than the previous one - '
                + ' no effect');
            assert.is(allValues.value, 2);
        });

        test('a perverse case with related streams', function() {
            var s = stream();
            // Ensure that streams yielded by `f` are updated at the same tick.
            var s1 = s.map(inc);
            var s2 = s.map(function(x) { return x * 10; });
            var streams = [s1, s2];

            var allValues = s.flatMap(function(idx) {
                return streams[idx];
            });

            s.set(0);
            assert.is(allValues.value, 1);
            s.set(1);
            assert.is(allValues.value, 10);
        });
    });
});
