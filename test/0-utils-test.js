test('0-utils-test.js', function() {
    test('toArray()', function() {

        function three() {
            var array = toArray(arguments);
            assert(array instanceof Array);
            assert.eq(array, [1, 2, 3]);
        }

        three(1, 2, 3);
    });
});
