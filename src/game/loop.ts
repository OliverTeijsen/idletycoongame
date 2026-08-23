/**
 * Fixed-timestep simulation (spec §5).
 *
 * `tick(state, dt)` advances every system in a fixed order (spec §9):
 *   compute multipliers → produce → autobuy → unlocks/achievements → sanitize.
 * It mutates the passed state object; the store owns making that visible to
 * React. Rendering is a separate rAF and never runs game logic.
 *
 * `createLoop` is the accumulator driver — platform-agnostic (the caller
 * supplies scheduling), deterministic given the same dt sequence (§19).
 */
import { BAL } from './balance';
import { clean } from './numbers';
import { tickDimensions } from './systems/dimensions';
import { tickMotes } from './systems/motes';
import { GameState } from './types';

export const TICK = 1 / BAL.tickRate;

/** Advance the simulation by dt seconds. Mutates `state`. */
export function tick(state: GameState, dt: number): void {
  if (!(dt > 0) || !Number.isFinite(dt)) return;

  // 1. Produce (multipliers are computed inside from current state).
  tickDimensions(state, dt);
  tickMotes(state, dt);

  // 2. Autobuyers — none until P1 (Phase 3).

  // 3. Unlock checks — tier reveal is driven by Dimension Boosts; the Motes
  //    tab reveals itself via motesUnlocked(). Nothing to mutate yet.

  // 4. Sanitize the hot accumulators every tick so a bad multiplier can never
  //    poison the save (spec §4).
  state.spark = clean(state.spark);
  state.motes = clean(state.motes);
  state.timePlayed += dt;
}

export interface LoopHandle {
  /** Feed real elapsed milliseconds; runs 0..n fixed ticks. */
  advance(nowMs: number): void;
  reset(nowMs: number): void;
}

/**
 * Accumulator: call `advance(now)` from rAF/interval; it invokes `onTick(TICK)`
 * for each elapsed fixed step. Gaps are clamped to 250ms — longer absences are
 * offline progress and handled by offline.ts, not by spinning the loop.
 */
export function createLoop(onTick: (dt: number) => void): LoopHandle {
  let acc = 0;
  let last: number | null = null;
  return {
    advance(nowMs: number) {
      if (last === null) {
        last = nowMs;
        return;
      }
      acc += Math.min(0.25, Math.max(0, (nowMs - last) / 1000));
      last = nowMs;
      while (acc >= TICK) {
        onTick(TICK);
        acc -= TICK;
      }
    },
    reset(nowMs: number) {
      acc = 0;
      last = nowMs;
    },
  };
}
