//
// 4-generators.js
//
// This file defines generators - streams that produce values according to
// certain conventions.
//

// Arrange for `f` to be called as soon as possible (after the current execution
// context has finished).
//
// TODO consider alternatives (setImmediate / process.nextTick / the equivalent
// in browsers). An ideal "immediate" scheduler should let events happen from
// time to time.
// function schedule(f) {
//     return setTimeout(f, 0);
// }
//
// function unschedule(handle) {
//     clearTimeout(handle);
// }

function generatorStream(options) {
    var result = stream([], options);

    function run() {
        while (!this.hasEnded()) {
            this.tick();
        }
    }

    result.run = run;

    return result;
}

// stream.from(Array array) -> Stream
//
// Produce all values in `array`, then end.
//
// stream.from(String string) -> Stream
//
// Produce all characters in `string`, then end.
//
// The resulting stream is a generator stream: you can ask it for values with
// `.tick()`, or by calling one of the various scheduling methods (TODO)
//
// TODO make it work on all iterables
stream.from = function(array) {
    var state = (typeof array === 'string') ? array.split('') : array.slice();

    function fromArrayTick() {
        if (this.state.length) {
            var next = this.state.shift();
            this.set(next);
        } else {
            this.end();
        }
    }

    return generatorStream({
        state: state,
        tick: fromArrayTick
    });
};

// stream.from(number start, optional number end, number step = 1) -> Stream
//
// Produce numbers from `start` to `end` (inclusive), then end.
//
// `step` can be negative.
//
// If `end` is not specified, produce numbers indefinitely.
//
//  var s = stream.range(0, 10, 2);
//
//  s: 2 4 6 8 10
stream.range = function(start, end, step = 1) {
    var direction = step > 0 ? 1 : -1;

    var state = {
        next: start,
        end: (end !== undefined) ? end : (Infinity * direction),
        step: step,
    };

    function rangeTick() {
        var direction = step > 0 ? 1 : -1;

        if (direction * this.state.next <= direction * this.state.end) {
            this.set(this.state.next);
            this.state.next += this.state.step;
        } else {
            this.end();
        }
    }

    return generatorStream({
        state: state,
        tick: rangeTick
    });
}

        // Could be mixed in from somewhere
        // start: function() {
        //     if (!this.timer) {
        //         this.scheduleNext();
        //     }
        //
        //     return this;
        // },
        //
        // stop: function() {
        //     if (this.timer) {
        //         unschedule(timer);
        //         delete this.timer;
        //     }
        //
        //     return this;
        // },
        //
        // scheduleNext: function() {
        //     this.timer = schedule(() => {
        //         this.tick();
        //     });
        // },
        //
