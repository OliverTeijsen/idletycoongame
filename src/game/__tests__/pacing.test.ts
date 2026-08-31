/**
 * Fast-forward balancing harness (spec Â§10, Â§18 Phase 2 acceptance).
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
 *
 * A timeout here does not fail cleanly: Jest cannot interrupt a synchronous
 * loop, so it tears the environment down while the simulation is still
 * running and the next global lookup explodes as "Cannot read properties of
 * undefined (reading 'isFinite')" or "... (reading 'isSafeInteger')". If you
 * ever see that, it is a timeout — not a corrupted Decimal — so raise the
 * budget.
 *
 * Measured, this suite runs in ~16s on its own. The budget is forty times
 * that because `npm test` runs the core and app projects concurrently and
 * every worker is fighting for the same cores; at 300s it failed roughly one
 * run in three on a normal laptop, and a suite that fails one run in three is
 * a suite people learn to ignore. Nothing here is fast enough for a tight
 * budget to catch a real hang sooner than a person would.
 */
const PACING_TIMEOUT_MS = 600_000;

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
      `[pacing] first DimBoost: ${toFirstBoost}s · Collapse unlock (${BAL.collapse.unlockSpark.toString()} spark): ${
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
    // A soak test for finiteness, not a pacing measurement — so it shops on a
    // cadence rather than every second. Sweeping every shop 7,200 times over
    // dwarfs the ticks and pushed this past its budget; NaN would surface
    // either way.
    for (let sec = 0; sec < 7200; sec += 1) {
      if (sec < 600 || sec % 4 === 0) playSecond(s, sec < 60 ? 4 : 0);
      else for (let t = 0; t < BAL.tickRate; t++) tick(s, DT);
    }
    expect(Number.isNaN(s.spark.mantissa)).toBe(false);
    expect(Number.isNaN(s.motes.mantissa)).toBe(false);
    for (const d of s.dims) expect(Number.isNaN(d.amount.mantissa)).toBe(false);
    expect(s.spark.gte(0)).toBe(true);
    // eslint-disable-next-line no-console
    console.log(
      `[pacing] after 2h: spark=${s.spark.toString()} boosts=${s.dimBoosts} tiers=${highestUnlockedTier(s)}/${TIER_COUNT} motes=${s.motes.toString()}`,
    );
  }, PACING_TIMEOUT_MS);

  // NOTE: the Collapse/Ascend loop-acceleration tests that lived here were
  // retired in the Phase 10 balance pass. ladder.test.ts now walks the whole
  // prestige ladder from a fresh save and asserts the §10 windows directly,
  // including the "each layer makes the one below 3–10× faster to re-clear"
  // rule — so keeping a second, coarser copy here only meant two sets of
  // thresholds to keep in sync.

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
