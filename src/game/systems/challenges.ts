/**
 * Challenge run flow (spec §8.4): enter / abandon / auto-complete. The
 * restriction & reward composition lives in challengeperks.ts (leaf module);
 * this file owns the resets, so it may import prestige.ts.
 */
import { BAL, ChallengeDef } from '../balance';
import { Decimal } from '../numbers';
import { GameState } from '../types';
import { challengeTiers } from './challengeperks';
import { resetLayer0 } from './prestige';

export { challengeActive, challengeTiers } from './challengeperks';

const defs = new Map(BAL.challenges.defs.map((c) => [c.id, c]));

export function challengeDef(id: string): ChallengeDef | undefined {
  return defs.get(id);
}

export function challengesUnlocked(state: GameState): boolean {
  return state.ascends > 0;
}

/** Spark goal for the NEXT tier of a challenge. */
export function challengeGoal(state: GameState, id: string): Decimal {
  const def = defs.get(id)!;
  return def.goalBase.mul(def.goalGrowth.pow(challengeTiers(state, id)));
}

export function canEnterChallenge(state: GameState, id: string): boolean {
  const def = defs.get(id);
  if (!def) return false;
  if (!challengesUnlocked(state)) return false;
  if (state.activeChallenge !== null) return false;
  return challengeTiers(state, id) < def.maxTier;
}

/** Enter a challenge: Layer-0 reset, restriction applies. */
export function enterChallenge(state: GameState, id: string): boolean {
  if (!canEnterChallenge(state, id)) return false;
  resetLayer0(state);
  state.activeChallenge = id;
  return true;
}

/** Abandon the active challenge: Layer-0 reset, no reward. */
export function exitChallenge(state: GameState): boolean {
  if (state.activeChallenge === null) return false;
  state.activeChallenge = null;
  resetLayer0(state);
  return true;
}

/**
 * Called from the tick unlock step: completes the active challenge when its
 * goal is reached. Returns the completed id (for UI toasts) or null.
 */
export function checkChallengeCompletion(state: GameState): string | null {
  const id = state.activeChallenge;
  if (id === null) return null;
  if (state.bestSparkRun.lt(challengeGoal(state, id))) return null;
  state.challenges = { ...state.challenges, [id]: challengeTiers(state, id) + 1 };
  state.activeChallenge = null;
  state.elements = {
    ...state.elements,
    points: state.elements.points + BAL.elements.pointsPerChallenge,
  };
  resetLayer0(state);
  return id;
}
