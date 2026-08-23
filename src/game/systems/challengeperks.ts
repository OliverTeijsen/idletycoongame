/**
 * Challenge restriction & reward composition — a leaf module (imports only
 * balance/numbers/types) so multipliers.ts, dimensions.ts and motes.ts can
 * read it without an import cycle. Run flow (enter/exit/complete) lives in
 * challenges.ts.
 */
import { BAL } from '../balance';
import { D, Decimal, cleanMul } from '../numbers';
import { GameState } from '../types';

export function challengeActive(state: GameState, id: string): boolean {
  return state.activeChallenge === id;
}

export function challengeTiers(state: GameState, id: string): number {
  return state.challenges[id] ?? 0;
}

/** Permanent reward: Still Ring — base speed +50% per tier. */
export function challengeSpeedMult(state: GameState): Decimal {
  return cleanMul(BAL.challenges.stillRingReward.pow(challengeTiers(state, 'stillRing')));
}

/** Permanent reward: Famine — Mote gain ×3 per tier. */
export function challengeMoteMult(state: GameState): Decimal {
  return cleanMul(BAL.challenges.famineReward.pow(challengeTiers(state, 'famine')));
}

/** Permanent reward: Solitary — all tier production +10% per tier. */
export function challengeTierMult(state: GameState): Decimal {
  return cleanMul(BAL.challenges.solitaryReward.pow(challengeTiers(state, 'solitary')));
}

/** Effective cost-growth: Brittle restriction and/or its permanent reward. */
export function costGrowthFor(state: GameState, baseGrowth: Decimal): Decimal {
  let g = baseGrowth;
  if (challengeActive(state, 'brittle')) g = g.pow(BAL.challenges.brittleGrowthExp);
  const tiers = challengeTiers(state, 'brittle');
  if (tiers > 0) g = g.pow(Math.pow(BAL.challenges.brittleRewardExp, tiers));
  // growth below 1.05 would trivialize cost math — clamp.
  return Decimal.max(D(1.05), g);
}
