test('4-stream-operators-test.js', function() {
    function inc(x) {
        return x + 1;
    }

    function plus(x, y) {
        return x + y;
    }

    function isOdd(x) {
        return x % 2 !== 0;
    }

    test('Stream::map()', function() {
        var s = stream();
        var s2 = s.map(inc);
        assert.is(s2.value, undefined);
        s.set(1);
        assert.is(s2.value, 2);
    });

    test('Stream::map() with initial value', function() {
        var s = stream().set(1);
        var s2 = s.map(inc);
        assert.is(s2.value, 2);
    });

    test('Stream::filter()', function() {
        var s = stream();
        var s2 = s.filter(isOdd);

        s.set(1);
        assert.is(s2.value, 1);
        s.set(2);
        assert.is(s2.value, 1);
        s.set(3);
        assert.is(s2.value, 3);
    });

    test('Stream::filter() with initial value', function() {
        var s = stream().set(1);
        var s2 = s.filter(isOdd);

        assert.is(s2.value, 1);
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
    });
});
