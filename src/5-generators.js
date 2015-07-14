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
    return stream([], {
        state: state,

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

        // Produce the next value or end the stream
        tick: function() {
            if (this.state.length) {
                var next = this.state.shift();
                this.set(next);
            } else {
                this.end();
            }
        }
    });
};
