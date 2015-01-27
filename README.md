# downstream

Downstream is a reactive programming library for JavaScript.

Its purpose is to be easy to understand, easy to extend, and easy to debug.

## Getting started

### Installation (browser)

    git clone https://github.com/anttisykari/dstream
    
    <script src='dstream.js'></script>
    
### Installation (node.js)

    npm install dstream
    
    var stream = require('dstream');
    
### First steps

    // Create a source stream
    var s = stream();
    
    // You can observe stream's values
    s.forEach(function(value) {
        console.log('I got a value', value);
    });
    
    // You can set its value
    s.set(1);
    // -> I got a value 1

    // You can create a derived stream
    var s2 = stream.map(function(value) {
        return value * 2;
    });
    
    s2.forEach(function(value) {
        console.log('s2', value);
    });
    
    s.set(123):
    // -> s2 246
    
    
## Anatomy of a stream

### Stream's properties

* value
* children
* parents
* update (source stream)

### Source streams

### Derived streams

## Using streams

...
