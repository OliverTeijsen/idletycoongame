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
  /** True once the rewarded double-offline has been applied. */
  doubled: boolean;
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
  return simulateOffline(state, elapsedSeconds);
}

/**
 * Grant the rewarded "double offline" (spec §15): pay out the same summary a
 * second time. Takes the ORIGINAL summary so the doubling is exactly what the
 * player was shown — re-simulating would compound the first grant and pay out
 * more than double.
 */
export function grantDoubleOffline(state: GameState, summary: OfflineSummary): OfflineSummary {
  const extraSpark = summary.sparkGained.mul(BAL.rewards.offlineMult.sub(1));
  const extraMotes = summary.motesGained.mul(BAL.rewards.offlineMult.sub(1));
  const extraOre = summary.oreGained.mul(BAL.rewards.offlineMult.sub(1));

  state.spark = clean(state.spark.add(extraSpark));
  state.totalSpark = clean(state.totalSpark.add(extraSpark));
  if (state.spark.gt(state.bestSparkRun)) state.bestSparkRun = state.spark;
  state.motes = clean(state.motes.add(extraMotes));
  state.motesEver = clean(state.motesEver.add(extraMotes));
  state.ore = clean(state.ore.add(extraOre));

  return {
    ...summary,
    sparkGained: summary.sparkGained.add(extraSpark),
    motesGained: summary.motesGained.add(extraMotes),
    oreGained: summary.oreGained.add(extraOre),
    doubled: true,
  };
}

function simulateOffline(state: GameState, elapsedSeconds: number): OfflineSummary | null {
  const cap = offlineCapSeconds(state);
  const clamped = Math.min(Math.max(0, elapsedSeconds), cap);
  if (clamped < 10) return null;

  const sparkBefore = state.spark;
  const motesBefore = state.motes;
  const oreBefore = state.ore;
  const fluxBefore = state.flux;

  const step = clamped / BAL.offline.chunkSteps;
  for (let i = 0; i < BAL.offline.chunkSteps; i++) tick(state, step);

  const overflowSeconds = Math.max(0, elapsedSeconds - cap);
  const overflowFlux = fluxFromOverflow(state, overflowSeconds);
  if (overflowFlux.gt(0)) state.flux = clean(state.flux.add(overflowFlux));
  // The summary reports ALL the Flux the absence produced — the overflow bonus
  // AND the online trickle the simulated hours paid — because that is what the
  // player's balance actually moved by. Reporting only the overflow made the
  // modal quietly disagree with the number on the Mine tab.
  const fluxGained = clean(state.flux.sub(fluxBefore));

  return {
    seconds: clamped,
    overflowSeconds,
    sparkGained: state.spark.sub(sparkBefore),
    motesGained: state.motes.sub(motesBefore),
    oreGained: state.ore.sub(oreBefore),
    fluxGained,
    doubled: false,
  };
}
