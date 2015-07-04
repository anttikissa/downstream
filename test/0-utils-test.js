test('0-utils-test.js', function() {
    test('extend()', function() {
        test('with one argument, does nothing');
        assert.eq(extend({ x: 1 }), { x: 1 });
        test('with two arguments, extends');
        assert.eq(extend({ x: 1 }, { y: 2 }), { x: 1, y: 2});
        test('with three, extends more');
        assert.eq(extend({ x: 1 }, { y: 2 }, { z: 3 }), { x: 1, y: 2, z: 3 });

        test('changes the first argument');
        var o = {};
        extend(o, { x: 1 });
        assert.is(o.x, 1);

        test('handles undefined');
        assert.eq(extend({}, { x: 1 }, undefined, { y: 2 }), { x: 1, y: 2 });

        test('overriding values');
        assert.eq(extend({}, { x: 1 }, { x: 2, y: 3 }, { y: 4, z: 5 }), {
            x: 2, y: 4, z: 5
        });
    });
});
