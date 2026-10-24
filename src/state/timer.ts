/** Timer utilities for measuring elapsed game time.
 *
 * The timer tracks start, pause, resume, and stop events. Elapsed time only
 * increases while the timer is running – pauses are excluded. The internal
 * clock (`now`) is provided by the caller so that tests can control time.
 */

export interface Timer {
  /** Start the timer (records start timestamp). */
  start(): void;
  /** Pause the timer – subsequent time does not accumulate. */
  pause(): void;
  /** Resume after pause. */
  resume(): void;
  /** Stop the timer – finalizes elapsed time. */
  stop(): void;
  /** Return elapsed milliseconds (does not decrease). */
  elapsedMs(): number;
}

/**
 * Create a timer instance.
 *
 * `now` returns the current timestamp in milliseconds. `initialElapsed` seeds
 * the timer with time already played, which is what a restored game needs: the
 * persisted `elapsedMs` is effective play time, not a wall clock.
 */
export const createTimer = (now: () => number, initialElapsed = 0): Timer => {
  let startTs = 0;
  let elapsed = Math.max(0, initialElapsed);
  let running = false;
  let highWater = elapsed;
  return {
    start() {
      if (!running) {
        startTs = now();
        running = true;
      }
    },
    pause() {
      if (running) {
        const cur = now();
        elapsed += Math.max(0, cur - startTs);
        if (elapsed > highWater) highWater = elapsed;
        running = false;
      }
    },
    resume() {
      if (!running) {
        startTs = now();
        running = true;
      }
    },
    stop() {
      if (running) {
        const cur = now();
        elapsed += Math.max(0, cur - startTs);
        if (elapsed > highWater) highWater = elapsed;
        running = false;
      }
    },
    elapsedMs() {
      // The clock can go backwards (an injected `now` in tests, or a system
      // clock adjustment). Elapsed game time must never decrease, so the
      // high-water mark is kept explicitly.
      const current = running ? elapsed + Math.max(0, now() - startTs) : elapsed;
      if (current > highWater) highWater = current;
      return highWater;
    },
  };
};

