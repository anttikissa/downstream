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
// The resulting stream is a generator stream: you can ask it for values with
// `.tick()`, or by calling one of the various scheduling methods (TODO)
stream.from = function(array) {
    return stream([], {
        // TODO is state better?
        data: array.slice(),

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
            if (this.data.length) {
                var next = this.data.shift();
                this.set(next);
            } else {
                this.end();
            }
        }
    });
}
