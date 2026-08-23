/**
 * Offline progress (spec §5).
 *
 * The dimension chain has feedback (tiers feed tiers), so closed-form isn't
 * exact; we step `tick()` in `chunkSteps` coarse chunks instead. Elapsed time
 * is clamped to [0, cap] — a clock set backwards grants nothing, and time
 * beyond the cap will roll into Flux once Time Flux exists (Phase 5).
 */
import { BAL } from './balance';
import { Decimal } from './numbers';
import { tick } from './loop';
import { GameState } from './types';

export interface OfflineSummary {
  /** Simulated seconds (after cap). */
  seconds: number;
  /** Seconds beyond the cap (future Flux). */
  overflowSeconds: number;
  sparkGained: Decimal;
  motesGained: Decimal;
}

export function offlineCapSeconds(_state: GameState): number {
  return BAL.offline.baseCapH * 3600;
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

  const step = clamped / BAL.offline.chunkSteps;
  for (let i = 0; i < BAL.offline.chunkSteps; i++) tick(state, step);

  return {
    seconds: clamped,
    overflowSeconds: Math.max(0, elapsedSeconds - cap),
    sparkGained: state.spark.sub(sparkBefore),
    motesGained: state.motes.sub(motesBefore),
  };
}
