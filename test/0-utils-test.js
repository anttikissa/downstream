test('0-utils-test.js', function() {
    test('isArray()', function() {
        test('an array is an array');
        var arr = [1, 2, 3];
        assert(isArray(arr));

        test('an object is not an array');
        var obj = { x: 1 };
        assert(!isArray(obj));

        test('arguments is not an array');
        assert(!isArray(arguments));
    });
});
