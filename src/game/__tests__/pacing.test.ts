/**
 * Fast-forward balancing harness (spec §10, §18 Phase 2 acceptance).
 *
 * Simulates a reasonable greedy player at full tick resolution and measures
 * time-to-milestone. The logged numbers are the input to Phase 10 tuning;
 * the assertions only guard against the economy being *broken* (unreachable
 * or trivial), not against taste.
 */
import { BAL } from '../balance';
import { tick } from '../loop';
import { defaultState } from '../state';
import { D } from '../numbers';
import {
  TIER_COUNT,
  buyDim,
  canDimBoost,
  doDimBoost,
  highestUnlockedTier,
} from '../systems/dimensions';
import { buyMoteUpgrade } from '../systems/motes';
import {
  buyPrismUpgrade,
  buyShardUpgrade,
  canAscend,
  canCollapse,
  canUnify,
  collapseGain,
  doAscend,
  doCollapse,
  doUnify,
} from '../systems/prestige';
import { buyStarNode } from '../systems/starchart';
import { buySparkUpgrade, tapPower } from '../systems/upgrades';
import { GameState } from '../types';

const DT = 1 / BAL.tickRate;

/** One simulated second of greedy play: tap, shop, boost. */
function playSecond(s: GameState, tapsPerSecond: number): void {
  for (let t = 0; t < BAL.tickRate; t++) {
    tick(s, DT);
    if (t < tapsPerSecond) {
      s.spark = s.spark.add(tapPower(s));
      s.totalTaps += 1;
    }
  }
  if (canDimBoost(s)) doDimBoost(s);
  for (const u of BAL.sparkUpgrades) buySparkUpgrade(s, u.id);
  for (const u of BAL.motes.upgrades) buyMoteUpgrade(s, u.id);
  for (let tier = highestUnlockedTier(s); tier >= 1; tier--) buyDim(s, tier, 'MAX');
}

function secondsUntil(s: GameState, done: (s: GameState) => boolean, maxSeconds: number): number {
  for (let sec = 0; sec < maxSeconds; sec++) {
    if (done(s)) return sec;
    // Active tapping for the first 3 minutes, then idle-with-shopping.
    playSecond(s, sec < 180 ? 4 : 0);
  }
  return -1;
}

/**
 * These simulate tens of thousands of ticks each — well past Jest's 5s
 * default, especially when the `core` and `app` projects run in parallel and
 * contend for CPU. Without an explicit budget they fail intermittently.
 */
const PACING_TIMEOUT_MS = 120_000;

describe('pacing', () => {
  it('first orbiter is reachable inside a minute of tapping', () => {
    const s = defaultState(0);
    const t = secondsUntil(s, (st) => st.dims[0].amount.gte(1), 60);
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThan(30);
  });

  it('milestones land in sane windows for a greedy player', () => {
    const s = defaultState(0);
    const toFirstBoost = secondsUntil(s, (st) => st.dimBoosts >= 1, 3600);
    // Cumulative from game start: continue the same run and add the segments.
    const afterBoost = secondsUntil(
      s,
      (st) => st.bestSparkRun.gte(BAL.collapse.unlockSpark),
      4 * 3600,
    );
    const toCollapseUnlock = afterBoost < 0 ? -1 : toFirstBoost + afterBoost;
    // eslint-disable-next-line no-console
    console.log(
      `[pacing] first DimBoost: ${toFirstBoost}s · Collapse unlock (1e6 spark): ${
        toCollapseUnlock < 0 ? 'NOT REACHED' : `${toCollapseUnlock}s from start`
      } · boosts=${s.dimBoosts} · highest tier=${highestUnlockedTier(s)}`,
    );

    // First soft reset should arrive early (spec: "2–10 min" window).
    expect(toFirstBoost).toBeGreaterThan(30);
    expect(toFirstBoost).toBeLessThan(900);

    // Collapse unlock (spec target ~15 min for a human; a frame-perfect bot
    // is faster): broken if < 3 min or > 90 min from game start.
    expect(toCollapseUnlock).toBeGreaterThan(180);
    expect(toCollapseUnlock).toBeLessThan(5400);
  }, PACING_TIMEOUT_MS);

  it('two hours of greedy play never poisons the state', () => {
    const s = defaultState(0);
    for (let sec = 0; sec < 7200; sec += 1) playSecond(s, sec < 60 ? 4 : 0);
    expect(Number.isNaN(s.spark.mantissa)).toBe(false);
    expect(Number.isNaN(s.motes.mantissa)).toBe(false);
    for (const d of s.dims) expect(Number.isNaN(d.amount.mantissa)).toBe(false);
    expect(s.spark.gte(0)).toBe(true);
    // eslint-disable-next-line no-console
    console.log(
      `[pacing] after 2h: spark=${s.spark.toString()} boosts=${s.dimBoosts} tiers=${highestUnlockedTier(s)}/${TIER_COUNT} motes=${s.motes.toString()}`,
    );
  }, PACING_TIMEOUT_MS);

  it('the collapse loop accelerates re-runs and reaches Ascend-scale shards', () => {
    const s = defaultState(0);

    /** Greedy P1 player: collapse when the gain is a meaningful step up. */
    const playWithCollapses = (sec: number) => {
      playSecond(s, sec < 180 ? 4 : 0);
      if (canCollapse(s)) {
        const gain = collapseGain(s);
        // collapse when gain would at least +25% our shard stash (or first time)
        if (s.collapses === 0 || gain.gte(s.shards.add(1).mul(0.25))) doCollapse(s);
      }
      for (const u of BAL.shardUpgrades) buyShardUpgrade(s, u.id);
      for (const n of BAL.starChart) buyStarNode(s, n.id);
    };

    let firstCollapseAt = -1;
    let secondCollapseAt = -1;
    let ascendReadyAt = -1;
    const HORIZON = 3 * 3600;
    for (let sec = 0; sec < HORIZON; sec++) {
      playWithCollapses(sec);
      if (firstCollapseAt < 0 && s.collapses >= 1) firstCollapseAt = sec;
      if (secondCollapseAt < 0 && s.collapses >= 2) secondCollapseAt = sec;
      if (ascendReadyAt < 0 && s.bestShards.gte(50)) {
        ascendReadyAt = sec;
        break;
      }
    }
    // eslint-disable-next-line no-console
    console.log(
      `[pacing] collapse#1: ${firstCollapseAt}s · collapse#2: +${secondCollapseAt - firstCollapseAt}s · 50 bestShards: ${ascendReadyAt}s · collapses=${s.collapses} shardsEver=${s.shardsEver.toString()}`,
    );

    expect(firstCollapseAt).toBeGreaterThan(0);
    // the re-run to the second collapse must be faster than the first climb
    expect(secondCollapseAt - firstCollapseAt).toBeLessThan(firstCollapseAt);
    // Ascend threshold (bestShards ≥ 50) reachable within the horizon
    // (spec window: 45–90 min for a human; the bot is faster)
    expect(ascendReadyAt).toBeGreaterThan(300);
    expect(ascendReadyAt).toBeLessThan(HORIZON);
    // no state poisoning across many resets
    expect(Number.isNaN(s.spark.mantissa)).toBe(false);
    expect(Number.isNaN(s.shards.mantissa)).toBe(false);
  }, PACING_TIMEOUT_MS);

  it('the ascend loop reaches P2 and re-collapsing after it is faster', () => {
    const s = defaultState(0);

    /** Greedy P1+P2 player: collapse/ascend eagerly, spend everything. */
    const playWithAscends = (sec: number) => {
      playSecond(s, sec < 180 ? 4 : 0);
      if (canAscend(s)) doAscend(s);
      else if (canCollapse(s)) {
        const gain = collapseGain(s);
        if (s.collapses === 0 || gain.gte(s.shards.add(1).mul(0.25))) doCollapse(s);
      }
      for (const u of BAL.shardUpgrades) buyShardUpgrade(s, u.id);
      for (const u of BAL.prismGrid) buyPrismUpgrade(s, u.id);
      for (const n of BAL.starChart) buyStarNode(s, n.id);
    };

    let ascendAt = -1;
    let collapsesBeforeAscend = 0;
    let reclearAt = -1;
    const HORIZON = 4 * 3600;
    for (let sec = 0; sec < HORIZON; sec++) {
      playWithAscends(sec);
      if (ascendAt < 0 && s.ascends >= 1) {
        ascendAt = sec;
        collapsesBeforeAscend = s.collapses; // lifetime counter — kept by Ascend
      }
      // §10: each prestige should make the previous layer faster to RE-CLEAR.
      // The P1 layer's clear = reaching the Ascend threshold again.
      if (ascendAt >= 0 && reclearAt < 0 && s.bestShards.gte(BAL.ascend.unlockShards.toNumber())) {
        reclearAt = sec - ascendAt;
        break;
      }
    }
    // eslint-disable-next-line no-console
    console.log(
      `[pacing] ascend#1: ${ascendAt}s (after ${collapsesBeforeAscend} collapses) · P1 re-clear post-ascend: +${reclearAt}s · prismEver=${s.prismEver.toString()}`,
    );

    expect(ascendAt).toBeGreaterThan(0);
    expect(ascendAt).toBeLessThan(HORIZON);
    // Re-clearing the P1 layer (50 bestShards again) must be meaningfully
    // faster than the original climb — Prism has to carry its weight.
    expect(reclearAt).toBeGreaterThan(0);
    expect(reclearAt).toBeLessThan(ascendAt / 2);
    expect(Number.isNaN(s.prism.mantissa)).toBe(false);
  }, PACING_TIMEOUT_MS);

  it('a fully automated endgame cycles forever without poisoning state', () => {
    // Seed a player who has finished the tree: every auto-prestige owned, so
    // the game plays itself. This is the §20 "you never really stop" state.
    const s = defaultState(0);
    s.collapses = 1;
    s.ascends = 1;
    s.converges = 1;
    s.unifies = 1;
    s.singularityEver = D(1);
    s.metaShop = { autoAscend: true, autoConverge: true, metaEngine: true };
    s.aeonTree = { autoCollapse: true, dimPower: true };
    s.research = { singularitySeed: true, gyreHeart: true };
    s.spark = D(1e6);

    const HORIZON = 1800; // 30 simulated minutes is plenty to prove it cycles
    let unifiesDone = 0;
    for (let sec = 0; sec < HORIZON; sec++) {
      playSecond(s, 0); // pure idle: automation does everything
      if (canUnify(s)) {
        doUnify(s);
        unifiesDone += 1;
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `[pacing] automated ${HORIZON / 60}min: unifies=${unifiesDone} singularityEver=${s.singularityEver.toString()} collapses=${s.collapses} ascends=${s.ascends} converges=${s.converges}`,
    );

    // The machine must actually keep turning on its own.
    expect(s.collapses).toBeGreaterThan(1);
    expect(s.ascends).toBeGreaterThan(1);
    // …and nothing may go non-finite across all those nested resets.
    for (const v of [s.spark, s.motes, s.shards, s.prism, s.aeon, s.singularity, s.ore, s.flux]) {
      expect(Number.isNaN(v.mantissa)).toBe(false);
      expect(v.gte(0)).toBe(true);
    }
    for (const d of s.dims) expect(Number.isNaN(d.amount.mantissa)).toBe(false);
  }, PACING_TIMEOUT_MS);

  it('absurd wealth (1e300+) keeps ticking finitely', () => {
    const s = defaultState(0);
    s.spark = D('1e300');
    s.dims.forEach((d) => {
      d.unlocked = true;
      d.amount = D('1e300');
      d.bought = 100;
    });
    for (let i = 0; i < 200; i++) tick(s, DT);
    expect(Number.isNaN(s.spark.mantissa)).toBe(false);
    expect(s.spark.gt(D('1e300'))).toBe(true); // production continued past double range
  });
});
