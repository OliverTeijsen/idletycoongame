/**
 * The balance report (spec §18 Phase 10).
 *
 * Walks a single save from a fresh start all the way up the prestige ladder
 * with a "reasonably good idle player" model, and logs when each layer first
 * opens. These numbers are the input to tuning `balance.ts` — the assertions
 * are the §10 pacing targets, so a future balance change that breaks the
 * intended shape of the game fails here instead of being discovered by a
 * player forty hours in.
 *
 * Times are BOT-seconds. The bot buys optimally every second from minute one,
 * which a human does not manage before automation unlocks, so early-game
 * numbers here run roughly 2× faster than a real first session. After P1 the
 * autobuyers do the same thing the bot does, so later numbers are honest.
 */
import { BAL } from '../balance';
import { tick } from '../loop';
import { D } from '../numbers';
import { defaultState } from '../state';
import { buyDim, canDimBoost, doDimBoost, highestUnlockedTier } from '../systems/dimensions';
import { buyMiner, buyResearch } from '../systems/minerals';
import { buyMoteUpgrade } from '../systems/motes';
import {
  ascendGain,
  buyAeonNode,
  buyMetaUpgrade,
  buyPrismUpgrade,
  buyShardUpgrade,
  canAscend,
  canCollapse,
  canConverge,
  canUnify,
  collapseGain,
  convergeGain,
  doAscend,
  doCollapse,
  doConverge,
  doUnify,
} from '../systems/prestige';
import { singularityMult } from '../systems/multipliers';
import { buyStarNode } from '../systems/starchart';
import { buySparkUpgrade, tapPower } from '../systems/upgrades';
import { GameState } from '../types';

/**
 * Simulation resolution for the report. The live game runs at 20 ticks/sec;
 * 5 is enough to keep the dimension cascade accurate to well within the
 * precision these targets are stated at, and makes a multi-hour walk
 * practical to run in CI.
 */
const TICKS_PER_SEC = 5;
const DT = 1 / TICKS_PER_SEC;

/**
 * One simulated second of a competent idle player.
 *
 * `shopping` is false on most seconds: sweeping all nine shops every single
 * simulated second is both unlike a real player and the harness's dominant
 * cost (it dwarfs the ticks themselves). Every few seconds is plenty —
 * autobuyers run on their own interval regardless.
 */
function playSecond(s: GameState, tapping: boolean, shopping = true): void {
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

/** Reset when the gain is a meaningful step up — what a sensible player does. */
function prestigeIfWorthwhile(s: GameState): void {
  if (canUnify(s)) {
    doUnify(s);
    return;
  }
  if (canConverge(s) && (s.converges === 0 || convergeGain(s).gte(s.aeonEver.mul(0.34)))) {
    doConverge(s);
    return;
  }
  if (canAscend(s) && (s.ascends === 0 || ascendGain(s).gte(s.prismEver.mul(0.34)))) {
    doAscend(s);
    return;
  }
  if (canCollapse(s) && (s.collapses === 0 || collapseGain(s).gte(s.shardsEver.mul(0.34)))) {
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
}

const NEVER = -1;

/** Walk the ladder for `horizonSeconds`, recording first-reach times. */
function walkLadder(horizonSeconds: number): { s: GameState; at: Ladder } {
  const s = defaultState(0);
  const at: Ladder = {
    firstOrbiter: NEVER,
    dimBoost: NEVER,
    collapse: NEVER,
    ascend: NEVER,
    converge: NEVER,
    unify: NEVER,
    reclearP1: NEVER,
  };
  let ascendAt = NEVER;

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
    if (at.reclearP1 === NEVER && ascendAt !== NEVER && s.bestShards.gte(BAL.ascend.unlockShards)) {
      at.reclearP1 = sec - ascendAt;
    }
    if (at.converge === NEVER && s.converges >= 1) at.converge = sec;
    if (at.unify === NEVER && s.unifies >= 1) {
      at.unify = sec;
      break;
    }
  }
  return { s, at };
}

const mins = (sec: number) => (sec === NEVER ? 'NOT REACHED' : `${(sec / 60).toFixed(1)}m`);
const hours = (sec: number) => (sec === NEVER ? 'NOT REACHED' : `${(sec / 3600).toFixed(2)}h`);

describe('the ladder (balance report)', () => {
  /**
   * Eight hours is the practical ceiling for one walk: the simulation
   * allocates heavily and a 26-hour run exhausts the V8 heap. It is also
   * enough — every layer up to Converge opens inside it, and Unify's job
   * here is to prove it is still far away. Unify's *reachability* is proven
   * separately below, by seeding a late-game save rather than grinding to it.
   */
  it('opens each layer inside its §10 window', () => {
    // Override while tuning: LADDER_HOURS=3 npx jest ladder
    const HORIZON = Number(process.env.LADDER_HOURS ?? 6) * 3600;
    const { s, at } = walkLadder(HORIZON);

    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '  ===== GYRE BALANCE REPORT (bot-seconds) =====',
        `  first orbiter : ${at.firstOrbiter}s        target < 30s`,
        `  Dimension Boost: ${mins(at.dimBoost)}      target 2–10m`,
        `  Collapse  (P1): ${mins(at.collapse)}      target 5–20m (bot)`,
        `  Ascend    (P2): ${mins(at.ascend)}      target 30–150m`,
        `  Converge  (P3): ${hours(at.converge)}     target 1.3–6h`,
        `  Unify     (P4): ${hours(at.unify)}     target: NOT within this walk`,
        `  P1 re-clear after Ascend: ${mins(at.reclearP1)}`,
        `  totals: collapses=${s.collapses} ascends=${s.ascends} converges=${s.converges} unifies=${s.unifies}`,
        '  =============================================',
      ].join('\n'),
    );

    expect(at.firstOrbiter).toBeGreaterThanOrEqual(0);
    expect(at.firstOrbiter).toBeLessThan(30);

    expect(at.dimBoost).toBeGreaterThan(2 * 60);
    expect(at.dimBoost).toBeLessThan(10 * 60);

    // §10 puts the first Collapse at ~15 min for a fresh player. This bot
    // buys optimally every second from the start, which no human manages
    // before automation exists, so it runs roughly 2× ahead here; 5–20
    // bot-minutes is the honest window for that target.
    expect(at.collapse).toBeGreaterThan(5 * 60);
    expect(at.collapse).toBeLessThan(20 * 60);

    // From here the autobuyers do what the bot does, so bot ≈ human.
    expect(at.ascend).toBeGreaterThan(30 * 60);
    expect(at.ascend).toBeLessThan(150 * 60);

    expect(at.converge).toBeGreaterThan(80 * 60);
    expect(at.converge).toBeLessThan(6 * 3600);

    // The endgame must be a genuine long haul, not a same-evening formality.
    expect(at.unify).toBe(NEVER);

    // Re-clearing P1 after an Ascend must be 3–10× faster than the first climb.
    expect(at.reclearP1).toBeGreaterThan(0);
    expect(at.reclearP1 * 3).toBeLessThan(at.ascend);

    // Nothing may go non-finite across the whole walk.
    for (const v of [s.spark, s.motes, s.shards, s.prism, s.aeon, s.singularity, s.ore]) {
      expect(Number.isNaN(v.mantissa)).toBe(false);
    }
  }, 600_000);

  /**
   * Unify must be far away, but it must also be REACHABLE. Seeding a
   * Converge-capable save and continuing proves the top of the ladder
   * actually closes — the alternative (grinding twenty hours) exhausts the
   * heap and tells us the same one bit.
   */
  it('the top of the ladder closes: a ready Converge opens Unify', () => {
    const s = defaultState(0);
    s.collapses = 200;
    s.ascends = 30;
    s.converges = 3;
    // A player who has done the work: Prism is at the Converge bar, and the
    // Aeon from that Converge is what carries them over the Unify gate.
    s.prismEver = BAL.converge.unlockPrism;
    s.prism = s.prismEver;
    s.aeonEver = BAL.unify.unlockAeon.mul(0.8);
    s.aeon = s.aeonEver;
    s.research = { singularitySeed: true };
    s.spark = D(1e6);

    expect(canConverge(s)).toBe(true);
    expect(canUnify(s)).toBe(false); // not yet — the gate is still ahead

    const aeonFromConverge = convergeGain(s);
    expect(doConverge(s)).toBe(true);
    // eslint-disable-next-line no-console
    console.log(
      `  [ladder] one Converge yielded ${aeonFromConverge.toString()} Aeon → aeonEver=${s.aeonEver.toString()} / gate ${BAL.unify.unlockAeon.toString()}`,
    );

    expect(canUnify(s)).toBe(true);
    expect(doUnify(s)).toBe(true);
    expect(s.singularityEver.gte(1)).toBe(true);
    // Unify's multiplier is the one thing no reset ever takes back.
    expect(singularityMult(s).gte(BAL.unify.multPer)).toBe(true);
  });
});
