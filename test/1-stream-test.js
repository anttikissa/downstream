test('1-stream-test.js', function() {

    test('stream()', function() {
        var s = stream();
        assert(s.value === undefined);
        assert.eq(s.parents, []);
        assert.eq(s.children, []);
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
