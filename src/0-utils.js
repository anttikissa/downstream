//
// downstream.js
//
// How to read type signatures:
//
// "someFunction(Type x)" means:
// `x` must be of type `Type` in the sense that `x instanceof Type` must be true
//
// "someFunction(type x)" means:
// `x` must be of type `type` in the sense that `typeof x` must be `type`
//
// "someFunction(x)" means:
// `x` can be of any type
//
// "someFunction(optional x) means:
// `x` can be left unspecified
//
// Downstream's methods and functions appear in two namespaces:
//
// "Stream::f()" means that the function is found in `Stream.prototype`, i.e.,
// it's a method of type `Stream`
//
// "stream.f()" means that the function is is found directly in `stream`
// namespace without requiring an instance of `Stream`
//
// The `stream` namespace is what you get with:
// `var stream = require('downstream');`
//

//
// 1-stream.js
//
// This file contains the constructor new Stream(), and the equivalent function
// stream(), along with some debugging tools.
//

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

// isArray(object)
//
// Is `object` an array?
function isArray(object) {
	return Array.isArray(object);
}

// defer(Function f)
//
// Call 'f' a bit later.
var defer = typeof setImmediate === 'function' ? setImmediate : setTimeout;

// Type-checking utilities

// assertFunction(f)
//
// Throw user-readable error unless `f` is a function
function assertFunction(f) {
    if (typeof f !== 'function') {
        throw new Error('f (' + f + ') is not a function');
    }
}

// assertActive(Stream stream)
//
// Throw user-readable error if `stream` is ended or in error state
function assertActive(stream) {
    if (stream.state !== 'active') {
        throw new Error("stream is in state '" + stream.state
            + "', should be 'active'");
    }
}
