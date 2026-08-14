import Decimal from 'break_infinity.js';
import { useEffect, useRef, useState } from 'react';

/**
 * How fast the display chases the real value. Higher is snappier; 12 settles a
 * visible jump in roughly a quarter of a second.
 */
const RATE = 12;

/** Display refresh. 30fps is indistinguishable from 60 for a counter and half the renders. */
const FRAME_SECONDS = 1 / 30;

/** Settle when within this fraction of the target, so the counter stops twitching. */
const SNAP_RATIO = 1e-4;

/** A single frame can never advance the ease by more than this, after a stall. */
const MAX_STEP_SECONDS = 0.25;

/**
 * A Decimal that eases toward `target` instead of jumping to it.
 *
 * The easing runs on the JS thread, not in a Reanimated worklet: `Decimal` is a
 * class instance and cannot cross the worklet boundary. That is fine here — it
 * drives one small component, and once the value settles the loop stops calling
 * `setState`, so a screen at rest costs a comparison per frame and no renders.
 *
 * Exponential smoothing is frame-rate independent (`1 - e^(-k·dt)`), so a
 * dropped frame changes the timing of the ease, never its destination.
 */
export function useEasedDecimal(target: Decimal): Decimal {
  const [display, setDisplay] = useState(target);

  // The loop reads these rather than closing over props, so it never restarts.
  const displayRef = useRef(display);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    // Time waited since the last visual update. Also the `dt` handed to the
    // smoothing, so throttling to 30fps slows the refresh, not the ease itself.
    let pending = 0;

    const step = (): void => {
      const now = Date.now();
      pending += Math.min((now - last) / 1000, MAX_STEP_SECONDS);
      last = now;

      if (pending >= FRAME_SECONDS) {
        const goal = targetRef.current;
        const current = displayRef.current;
        const gap = goal.sub(current);

        // Snap when the remaining gap is invisible, and when the target is zero
        // (prestige) — proportional easing would otherwise crawl toward it forever.
        if (gap.abs().lte(goal.abs().mul(SNAP_RATIO)) || goal.eq(0)) {
          if (!current.eq(goal)) {
            displayRef.current = goal;
            setDisplay(goal);
          }
        } else {
          const next = current.add(gap.mul(1 - Math.exp(-RATE * pending)));
          displayRef.current = next;
          setDisplay(next);
        }

        pending = 0;
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return display;
}
