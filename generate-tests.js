var fs = require('fs');
var stream = require('./stream');

var source = fs.readFileSync('./stream.js', 'utf8');

var lines = stream.fromArray(source.split('\n'));

var lineContainsComment = lines.map(function(line) {
    // Who uses /* */ comments anyway
    return !!line.match(/\/\//g);
});

//var commentContents = lines.filter(function(line) {
//    return !!line.match(/\/\//g);
//});

lineContainsComment.log('lineContainsComment');
