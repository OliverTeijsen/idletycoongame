/**
 * Offline progress (spec §5) + Time Flux overflow (spec §8.6).
 *
 * The dimension chain has feedback (tiers feed tiers), so closed-form isn't
 * exact; we step `tick()` in `chunkSteps` coarse chunks instead. Elapsed time
 * is clamped to [0, cap] — a clock set backwards grants nothing — and once
 * Time Flux is unlocked (P3), time beyond the cap banks as Flux instead of
 * being lost.
 */
import { BAL } from './balance';
import { Decimal, clean } from './numbers';
import { tick } from './loop';
import { seerCapMult } from './systems/managers';
import { starOfflineCapHours } from './systems/starchart';
import { fluxFromOverflow } from './systems/timeflux';
import { GameState } from './types';

export interface OfflineSummary {
  /** Simulated seconds (after cap). */
  seconds: number;
  /** Seconds beyond the cap. */
  overflowSeconds: number;
  sparkGained: Decimal;
  motesGained: Decimal;
  oreGained: Decimal;
  fluxGained: Decimal;
}

export function offlineCapSeconds(state: GameState): number {
  let hours = BAL.offline.baseCapH + starOfflineCapHours(state);
  // Aeon: +1h per lifetime Aeon (clamped — a tampered save must not overflow).
  hours += BAL.converge.offlineCapHPer * Math.min(1000, Math.max(0, state.aeonEver.toNumber()));
  if (state.research['deepClock']) hours += 4;
  return hours * 3600 * seerCapMult(state);
}

/**
 * Simulate `elapsedSeconds` of absence against `state` (mutating it) and
 * return a summary for the "while you were away" modal. Returns null when
 * there is nothing worth showing (< 10s away).
 */
export function applyOffline(state: GameState, elapsedSeconds: number): OfflineSummary | null {
  const cap = offlineCapSeconds(state);
  const clamped = Math.min(Math.max(0, elapsedSeconds), cap);
  if (clamped < 10) return null;

  const sparkBefore = state.spark;
  const motesBefore = state.motes;
  const oreBefore = state.ore;

  const step = clamped / BAL.offline.chunkSteps;
  for (let i = 0; i < BAL.offline.chunkSteps; i++) tick(state, step);

  const overflowSeconds = Math.max(0, elapsedSeconds - cap);
  const fluxGained = fluxFromOverflow(state, overflowSeconds);
  if (fluxGained.gt(0)) state.flux = clean(state.flux.add(fluxGained));

  return {
    seconds: clamped,
    overflowSeconds,
    sparkGained: state.spark.sub(sparkBefore),
    motesGained: state.motes.sub(motesBefore),
    oreGained: state.ore.sub(oreBefore),
    fluxGained,
  };
}
