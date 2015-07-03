test('1-stream-test.js', function() {
    test('stream()', function() {
        test('basic functionality', function() {
            var s = stream();
            assert.is(s.value, undefined);
            assert.is(s.version, 0);
            assert.eq(s.parents, []);
            assert.eq(s.children, []);
        });
    });

    test('Stream::update() when not overridden', function() {
        var parent = stream();
        var child = stream();
        // Manually forge a parent-child relationship
        child.parents.push(parent);
        parent.children.push(child);

        assert.throws(function() {
            parent.set(1);
        }, 'Stream does not define update()');
    });
});
