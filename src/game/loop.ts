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
import { tickAutomation } from './systems/automation';
import { checkChallengeCompletion } from './systems/challenges';
import { tickDimensions } from './systems/dimensions';
import { tickElements } from './systems/elements';
import { tickMinerals } from './systems/minerals';
import { tickMotes } from './systems/motes';
import { tickTimers, warpFactor } from './systems/timeflux';
import { GameState } from './types';

export const TICK = 1 / BAL.tickRate;

/** Advance the simulation by dt REAL seconds. Mutates `state`. */
export function tick(state: GameState, dt: number): void {
  if (!(dt > 0) || !Number.isFinite(dt)) return;

  // Time Warp: production runs faster while the timer (real seconds) lasts.
  // gameSpeed scales the simulated dt, exactly as §5 prescribes.
  const simDt = dt * warpFactor(state);
  tickTimers(state, dt);

  // 1. Produce (multipliers are computed inside from current state).
  tickDimensions(state, simDt);
  tickMotes(state, simDt);
  tickMinerals(state, simDt);

  // 2. Autobuyers (P1+): rule-based purchases after production.
  tickAutomation(state, dt);

  // 3. Unlock/progress checks: challenge goals, element trickle.
  checkChallengeCompletion(state);
  tickElements(state, simDt);

  // 4. Sanitize the hot accumulators every tick so a bad multiplier can never
  //    poison the save (spec §4).
  state.spark = clean(state.spark);
  state.motes = clean(state.motes);
  state.shards = clean(state.shards);
  state.ore = clean(state.ore);
  state.flux = clean(state.flux);
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
