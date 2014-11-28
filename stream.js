function Stream(value) {
    this.value = value;
    this.children = [];
    this.listeners = [];
    this.parents = [];
    this.version = stream.mostRecentVersion;
}

function stream(value) {
    return new Stream(value);
}

stream.mostRecentVersion = 0;

stream.fromDomEvent = function(selector, event) {
    var element = document.querySelector(selector);
    var result = stream();
    element.addEventListener(event, function(ev) {
        result.set(ev);
    });
    return result;
};

stream.fromArray = function(array) {
    var result = stream();

    var index = 0;
    var interval = setInterval(function() {
        if (index === array.length) {
            clearInterval(interval);
            return;
        }
        result.set(array[index++]);
    });

    return result;
};

function updateOrder(s) {
    var dfsTraversalOrder = [];

    function dfs(node) {
        dfsTraversalOrder.push(node);
        node.children.forEach(dfs);
    }

    dfs(s);

    // result is a depth-first search of nodes
    // result = [ 1, 2, 4, 3, 4 ]
    // but it should be
    // result = [ 1, 2,    3, 4 ]

    // TODO make this faster than O(n)
    function isLastIndexOf(node, idx) {
        return dfsTraversalOrder.lastIndexOf(node) === idx;
    }

    // So we do some magic
    var result = [];
    dfsTraversalOrder.forEach(function(node, idx) {
        if (isLastIndexOf(node, idx)) {
            result.push(node);
        }
    });

    return result;
};

Stream.prototype.set = function(value) {
    stream.mostRecentVersion++;

    var streamsToUpdate = updateOrder(this);

    this.newValue(value);

    streamsToUpdate.forEach(function(s) {
        if (s.update) {
            if (s.parents.some(function(parent) { return parent.wasChanged(); })) {
                s.update.apply(s, s.parents);
            }
        }

        s.listeners.forEach(function(f) {
            if (s.wasChanged()) {
                f(s.value);
            }
        });
    });

    return this;
};

Stream.prototype.name = function(name) {
    this._name = name;
    return this;
};

Stream.prototype.newValue = function(value) {
    this.value = value;
    this.version = stream.mostRecentVersion;
};

Stream.prototype.wasChanged = function() {
    return this.version === stream.mostRecentVersion;
};

Stream.prototype.addChild = function(child) {
    child.parents.push(this);
    this.children.push(child);
};

Stream.prototype.map = function(f) {
    var that = this;
    function mapUpdate() {
        this.newValue(f(that.value));
    };

    return this.derive(mapUpdate);
};

Stream.prototype.filter = function(f) {
    var that = this;
    function filterUpdate() {
        if (f(that.value)) {
            this.newValue(that.value);
        }
    };

    return this.derive(filterUpdate);
};

Stream.prototype.derive = function(update, options) {
    // TODO: could inline this to get better error messages / debugging support
    return stream.derivedStream([this], update, options);
};

stream.derivedStream = function(parents, update, options) {
    var result = stream();

    options = options || {};
    for (var key in options) {
        result[key] = options[key];
    }

    parents.forEach(function(parent) {
        parent.addChild(result);
    });

    result.update = update;
    if (parents.some(function(parent) { return parent.hasValue(); })) {
        result.update.apply(result, result.parents);
    }

    return result;
};

Stream.prototype.combine = function(other, f) {
    var that = this;

    function combineUpdate() {
        this.newValue(f(that.value, other.value));
    };

    return stream.derivedStream([this, other], combineUpdate);
};

Stream.prototype.sampledBy = function(other) {
    var that = this;

    function sampledByUpdate() {
        if (other.wasChanged()) {
            this.newValue(that.value);
        }
    }

    return stream.derivedStream([this, other], sampledByUpdate);
};


Stream.prototype.hasValue = function() {
    return typeof this.value !== 'undefined';
};

Stream.prototype.onValue = function(f) {
    if (this.hasValue()) {
        f(this.value);
    }
    this.listeners.push(f);
};

Stream.prototype.log = function(prefix) {
    this.onValue(function(value) {
        if (prefix) {
            console.log(prefix, value);
        } else {
            console.log(value)
        }
    });
    return this;
};

Stream.prototype.merge = function(other) {
    var that = this;

    function mergeUpdate() {
        if (that.wasChanged()) {
            this.newValue(that.value);
        }
        if (other.wasChanged()) {
            this.newValue(other.value);
        }
    }

    return stream.derivedStream([this, other], mergeUpdate);
};

Stream.prototype.scan = function(initial, f) {
    var that = this;

    function scanUpdate() {
        this.newValue(f(this.value, that.value));
    };

    return this.derive(scanUpdate, { value: initial });
};

Stream.prototype.slidingWindow = function(n) {
    var that = this;

    function slidingWindowUpdate() {
        var newValue = this.value.concat([that.value]);
        if (newValue.length > this.n) {
            newValue.shift();
        }
        this.newValue(newValue);
    }

    return this.derive(slidingWindowUpdate, { value: [], n: n });
};

Stream.prototype.slidingWindowBy = function(s) {
    var that = this;

    function slidingWindowByUpdate() {
        if (that.wasChanged()) {
            var newValue = this.value.concat([that.value]);
            while (newValue.length > s.value) {
                newValue.shift();
            }
            this.newValue(newValue);
        }
    }

    return stream.derivedStream([this, s], slidingWindowByUpdate, { value: [] });
};

Stream.prototype.take = function(n) {
    var that = this;
    function takeUpdate() {
        if (n > 0) {
            this.newValue(that.value);
            n--;
        }
    }

    return this.derive(takeUpdate);
};

Stream.prototype.flatMap = function(f) {
    var that = this;

    function flatMapUpdate() {
        if (that.wasChanged()) {
            f(that.value).addChild(this);
        }

        for (var i = 1; i < this.parents.length; i++) {
            if (this.parents[i].wasChanged()) {
                this.newValue(this.parents[i].value);
            }
        }
    }

    return this.derive(flatMapUpdate);
};

Stream.prototype.flatMapLatest = function(f) {
    var that = this;

    function flatMapLatestUpdate() {
        if (that.wasChanged()) {
            f(that.value).addChild(this);
        }

        if (this.parents.length > 1) {
            var lastParent = this.parents[this.parents.length - 1];
            if (lastParent.wasChanged()) {
                this.newValue(lastParent.value);
            }
        }
    }

    return this.derive(flatMapLatestUpdate);
};

Stream.prototype.toProperty = function(initial) {

    var that = this;
    function toPropertyUpdate() {
        this.newValue(that.value);
    }

    var result = this.derive(toPropertyUpdate);
    result.value = initial;
    return result;
};

