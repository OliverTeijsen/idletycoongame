/**
 * Speedrun splits.
 *
 * GYRE is built to be finished over about a month of ordinary idle play, and
 * it is also built to be ROUTED: Trials gate the deep layers, Ore gates Unify,
 * and Prism can buy Shard rate, so the order you push the lanes in changes the
 * finishing time by a very large factor. A route is only worth optimising if
 * you can see what it cost, so the game timestamps each milestone the first
 * time it happens and never lets a reset take that back.
 *
 * The clock is `state.timePlayed` — simulated seconds, including offline
 * grants — not wall-clock. That is the honest measure for an idle game: it
 * counts the time the game actually ran, so a player who banks eight hours of
 * offline progress is credited with those eight hours rather than the four
 * seconds it took to apply them.
 *
 * Leaf-ish module: it reads state and BAL only, and is called from the tick's
 * unlock step next to achievements.
 */
import { BAL, MILESTONES, MilestoneId } from '../balance';
import { GameState } from '../types';

/** Has this milestone been reached (and stamped) already? */
export function milestoneAt(state: GameState, id: MilestoneId): number | null {
  const t = state.milestones[id];
  return typeof t === 'number' ? t : null;
}

function stamp(state: GameState, id: MilestoneId, reached: boolean): void {
  if (!reached || state.milestones[id] !== undefined) return;
  state.milestones = { ...state.milestones, [id]: state.timePlayed };
}

function trialTiers(state: GameState): number {
  return Object.values(state.challenges).reduce((a, b) => a + b, 0);
}

const TOTAL_TRIAL_TIERS = BAL.challenges.defs.reduce((sum, c) => sum + c.maxTier, 0);

/**
 * "Complete" for the purposes of the end-of-game split: every Trial tier, the
 * whole Meta Shop, and at least one Unify to have paid for it.
 *
 * That is the finish line the month-long pacing targets are stated against —
 * not "reach Unify", which is roughly the one-week mark.
 */
export function isComplete(state: GameState): boolean {
  return (
    state.unifies >= 1 &&
    trialTiers(state) >= TOTAL_TRIAL_TIERS &&
    BAL.metaShop.every((m) => state.metaShop[m.id] === true)
  );
}

/**
 * Stamp every newly-reached milestone. Cheap: each one short-circuits on the
 * `!== undefined` check the moment it has fired once.
 */
export function recordMilestones(state: GameState): void {
  stamp(state, 'firstOrbiter', state.dims[0].amount.gte(1));
  stamp(state, 'dimBoost', state.dimBoosts >= 1);
  stamp(state, 'collapse', state.collapses >= 1);
  stamp(state, 'ascend', state.ascends >= 1);
  stamp(state, 'trial', trialTiers(state) >= 1);
  stamp(state, 'converge', state.converges >= 1);
  stamp(state, 'unify', state.unifies >= 1);
  stamp(state, 'metaAll', BAL.metaShop.every((m) => state.metaShop[m.id] === true));
  stamp(state, 'trialsAll', trialTiers(state) >= TOTAL_TRIAL_TIERS);
  stamp(state, 'complete', isComplete(state));
}

export { MILESTONES, TOTAL_TRIAL_TIERS };
