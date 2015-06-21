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

        try {
            parent.set(1);
        } catch (error) {
            assert.is(error.message, "Stream does not define update()");
            return;
        }

        assert.fail();
    });

});
