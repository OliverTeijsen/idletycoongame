/**
 * The shared balance harness (spec §18 Phase 10).
 *
 * NOT a test file — it deliberately does not match jest's testMatch. It holds
 * the simulated player that both balance reports drive, so ladder.test.ts and
 * trials.test.ts can each run in their OWN worker.
 *
 * That split is not tidiness. Both reports are multi-hour simulations that
 * allocate hard, and with the two of them in one file the worker died of a V8
 * out-of-memory partway through — which jest surfaces as "Test suite failed
 * to run" next to a heap dump, not as anything resembling a balance problem.
 * One heavy report per file keeps each within a worker's heap. If a third
 * report ever appears, give it its own file too.
 */
import { BAL } from '../balance';
import { tick } from '../loop';
import { defaultState } from '../state';
import { buyDim, canDimBoost, doDimBoost, highestUnlockedTier } from '../systems/dimensions';
import { buyMiner, buyResearch } from '../systems/minerals';
import { buyMoteUpgrade } from '../systems/motes';
import {
  buyAeonNode,
  buyMetaUpgrade,
  buyPrismUpgrade,
  buyShardUpgrade,
  canUnify,
  doAscend,
  doCollapse,
  doConverge,
  doUnify,
  worthAscending,
  worthCollapsing,
  worthConverging,
} from '../systems/prestige';
import { buyStarNode } from '../systems/starchart';
import { buySparkUpgrade, tapPower } from '../systems/upgrades';
import { GameState } from '../types';

/**
 * Simulation resolution for the report. The live game runs at 20 ticks/sec;
 * 5 is enough to keep the dimension cascade accurate to well within the
 * precision these targets are stated at, and makes a multi-hour walk
 * practical to run in CI.
 */
export const TICKS_PER_SEC = 5;
const DT = 1 / TICKS_PER_SEC;

/**
 * One simulated second of a competent idle player.
 *
 * `shopping` is false on most seconds: sweeping all nine shops every single
 * simulated second is both unlike a real player and the harness's dominant
 * cost (it dwarfs the ticks themselves). Every few seconds is plenty —
 * autobuyers run on their own interval regardless.
 */
export function playSecond(s: GameState, tapping: boolean, shopping = true): void {
  for (let t = 0; t < TICKS_PER_SEC; t++) {
    tick(s, DT);
    if (tapping && t < 2) {
      s.spark = s.spark.add(tapPower(s));
      s.totalTaps += 1;
    }
  }
  if (!shopping) return;

  // Spend everything, deepest currency first.
  for (const m of BAL.metaShop) buyMetaUpgrade(s, m.id);
  for (const n of BAL.aeonTree) buyAeonNode(s, n.id);
  for (const r of BAL.research) buyResearch(s, r.id);
  for (const u of BAL.prismGrid) buyPrismUpgrade(s, u.id);
  for (const u of BAL.shardUpgrades) buyShardUpgrade(s, u.id);
  for (const n of BAL.starChart) buyStarNode(s, n.id);
  for (const u of BAL.sparkUpgrades) buySparkUpgrade(s, u.id);
  for (const u of BAL.motes.upgrades) buyMoteUpgrade(s, u.id);
  for (const m of BAL.miners) buyMiner(s, m.id);

  if (canDimBoost(s)) doDimBoost(s);
  for (let tier = highestUnlockedTier(s); tier >= 1; tier--) buyDim(s, tier, 'MAX');
}

/**
 * Reset when the gain is a meaningful step up — what a sensible player does.
 *
 * The rule itself lives in prestige.ts (worth*) because the game's own
 * auto-prestige toggles use it too: the bot in this report and the autobuyers
 * a player actually leaves running must not be playing different games.
 */
export function prestigeIfWorthwhile(s: GameState): void {
  if (canUnify(s)) {
    doUnify(s);
    return;
  }
  if (worthConverging(s)) {
    doConverge(s);
    return;
  }
  if (worthAscending(s)) {
    doAscend(s);
    return;
  }
  if (worthCollapsing(s)) {
    doCollapse(s);
  }
}

export interface Ladder {
  firstOrbiter: number;
  dimBoost: number;
  collapse: number;
  ascend: number;
  converge: number;
  unify: number;
  reclearP1: number;
  /** Every Converge in the walk, in seconds — the ladder's slowest heartbeat. */
  convergeEvery: number[];
}

export const NEVER = -1;

/**
 * Both reports here are multi-hour simulations, and `npm test` runs them
 * while the app project is also saturating the cores. See the note on
 * pacing.test.ts's budget: an under-sized one fails as a torn-down
 * environment ("Cannot read properties of undefined"), never as a clean
 * timeout, so it costs more to debug than it ever saves.
 */
export const LADDER_TIMEOUT_MS = 900_000;

/**
 * Walk the ladder for `horizonSeconds`, recording first-reach times.
 * `stopWhen` ends the walk early — used to land on a known rung.
 */
export function walkLadder(
  horizonSeconds: number,
  stopWhen?: (s: GameState) => boolean,
): { s: GameState; at: Ladder } {
  const s = defaultState(0);
  const at: Ladder = {
    firstOrbiter: NEVER,
    dimBoost: NEVER,
    collapse: NEVER,
    ascend: NEVER,
    converge: NEVER,
    unify: NEVER,
    reclearP1: NEVER,
    convergeEvery: [],
  };
  let ascendAt = NEVER;
  let converges = 0;

  for (let sec = 0; sec < horizonSeconds; sec++) {
    // Taps for the first two minutes. Shops every second through the manual
    // early game — where each purchase genuinely matters and a keen player is
    // watching — then settles to every 4th second once autobuyers exist.
    playSecond(s, sec < 120, sec < 900 || sec % 4 === 0);
    prestigeIfWorthwhile(s);

    if (at.firstOrbiter === NEVER && s.dims[0].amount.gte(1)) at.firstOrbiter = sec;
    if (at.dimBoost === NEVER && s.dimBoosts >= 1) at.dimBoost = sec;
    if (at.collapse === NEVER && s.collapses >= 1) at.collapse = sec;
    if (at.ascend === NEVER && s.ascends >= 1) {
      at.ascend = sec;
      ascendAt = sec;
    }
    // §10: each prestige makes the layer below 3–10× faster to re-clear.
    // Measured on shardsEver, not the balance: shardsEver is what the Ascend
    // gate and gain both read, so it is what "P1 is re-cleared" means. Against
    // the balance this read as far slower than it is, because the bot spends
    // every Shard on the Star Chart the moment it lands.
    if (at.reclearP1 === NEVER && ascendAt !== NEVER && s.shardsEver.gte(BAL.ascend.unlockShards)) {
      at.reclearP1 = sec - ascendAt;
    }
    if (s.converges > converges) {
      converges = s.converges;
      at.convergeEvery.push(sec);
      if (at.converge === NEVER) at.converge = sec;
    }
    if (at.unify === NEVER && s.unifies >= 1) {
      at.unify = sec;
      break;
    }
    if (stopWhen?.(s)) break;
  }
  return { s, at };
}

export const mins = (sec: number) => (sec === NEVER ? 'NOT REACHED' : `${(sec / 60).toFixed(1)}m`);
export const hours = (sec: number) => (sec === NEVER ? 'NOT REACHED' : `${(sec / 3600).toFixed(2)}h`);
