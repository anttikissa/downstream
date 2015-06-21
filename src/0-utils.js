// Copy all attributes from 'sources' to 'target'.
function extend(target /*, ...sources */) {
    for (var i = 1; i < arguments.length; i++) {
        if (arguments[i]) {
            for (var key in arguments[i]) {
                target[key] = arguments[i][key];
            }
        }
    }
}

// isArray(Object object)
//
// Is `object` an array?
function isArray(object) {
	return Array.isArray(object);
}

// defer(Function f)
//
// Call 'f' a bit later.
var defer = typeof setImmediate === 'function' ? setImmediate : setTimeout;
