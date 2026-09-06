/**
 * The LONG walk — the multi-day balance report (spec §10, Phase 12).
 *
 * GYRE is designed to be finished over roughly a month of ordinary idle play.
 * The six-hour `ladder.test.ts` walk cannot see that: it proves the first
 * evening is shaped correctly and then stops, which is exactly how the old
 * balance shipped an endgame that seized up at hour six. This report walks
 * days, at a coarser resolution, and asserts the shape of the rest of the game.
 *
 * ── HOW LONG IT WALKS ───────────────────────────────────────────────────────
 * `WALK_HOURS` (default 24) sets the horizon. The committed default is a DAY —
 * long enough to see P3 open and start beating, fast enough to live in
 * `npm test`. The month-scale run is opt-in, because it takes about ten
 * minutes:
 *
 *     WALK_HOURS=720 TRACE=1 npm run test:core -- longwalk
 *
 * The deep assertions below only run when the horizon is long enough to have
 * earned them. A 24-hour walk is not evidence about Unify either way, and a
 * test that asserts things its data cannot support is worse than no test.
 *
 * ── RESOLUTION ──────────────────────────────────────────────────────────────
 * It runs at ONE tick per simulated second instead of five, and shops every
 * tenth second instead of every fourth. Both make it read SLOWER than the real
 * 20-tick game: a coarse Euler step under-integrates the dimension cascade
 * (each tier feeds the one below it WITHIN a tick), and a bot that shops less
 * often leaves purchases on the table. Slow is the safe direction for a pacing
 * floor — a milestone this report puts on day nine will not turn out to be on
 * day twenty. `resolution.test.ts` measures the size of the gap.
 *
 * ── TRACE ───────────────────────────────────────────────────────────────────
 * `TRACE=1` prints a sampled curve of every counter. Tuning a five-layer ladder
 * from first-reach times alone is guesswork: when Converge lands twenty hours
 * late, the times cannot tell you whether Prism accrues too slowly, Shards do,
 * or the "worth taking?" rule is holding the Ascend back. The trace can.
 */
import { BAL } from '../balance';
import { isComplete } from '../systems/milestones';
import { globalMult } from '../systems/multipliers';
import { trialTiersCleared } from '../systems/prestige';
import { NEVER, days, formatSample, hours, mins, walkLadder } from './harness';

const TOTAL_TRIAL_TIERS = BAL.challenges.defs.reduce((sum, c) => sum + c.maxTier, 0);

/** A month-scale walk is ~2.6M ticks; jest's default budget is not close. */
const LONGWALK_TIMEOUT_MS = 1_800_000;

describe('the long walk (multi-day balance report)', () => {
  it('keeps every layer beating across days', () => {
    const HOURS = Number(process.env.WALK_HOURS ?? 24);
    const TRACE = process.env.TRACE === '1';
    const { s, at } = walkLadder(HOURS * 3600, undefined, {
      ticksPerSec: 1,
      shopEvery: 10,
      traceEvery: TRACE ? Number(process.env.TRACE_EVERY ?? 3600) : 0,
    });

    if (TRACE) {
      // eslint-disable-next-line no-console
      console.log(['', '  ===== CURVE =====', ...at.trace.map(formatSample)].join('\n  '));
    }

    const gaps = (ts: number[]) => ts.map((t, i) => t - (i === 0 ? 0 : ts[i - 1]));
    const convergeGaps = gaps(at.convergeEvery);
    const unifyGaps = gaps(at.unifyEvery);

    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        `  ===== GYRE LONG WALK (${HOURS}h horizon, bot-time) =====`,
        `  Dimension Boost : ${mins(at.dimBoost)}`,
        `  Collapse   (P1) : ${mins(at.collapse)}`,
        `  Ascend     (P2) : ${hours(at.ascend)}`,
        `  First Trial     : ${hours(at.trial)}`,
        `  Converge   (P3) : ${hours(at.converge)}   ${days(at.converge)}`,
        `  Unify      (P4) : ${hours(at.unify)}   ${days(at.unify)}`,
        '',
        `  Converges : ${s.converges}  (gaps h: ${
          convergeGaps.map((g) => (g / 3600).toFixed(1)).join(', ') || 'none'
        })`,
        `  Unifies   : ${s.unifies}  (gaps h: ${
          unifyGaps.map((g) => (g / 3600).toFixed(1)).join(', ') || 'none'
        })`,
        `  Collapses : ${s.collapses}   Ascends: ${s.ascends}`,
        `  Trial tiers : ${trialTiersCleared(s)} / ${TOTAL_TRIAL_TIERS}, in ${hours(
          at.trialSeconds,
        )} of Trial runs`,
        `  Meta Shop : ${BAL.metaShop.filter((m) => s.metaShop[m.id]).length} / ${
          BAL.metaShop.length
        }`,
        `  Complete  : ${isComplete(s)}`,
        '',
        `  spark=${s.spark.toString().slice(0, 24)}  global=×${globalMult(s)
          .toString()
          .slice(0, 20)}`,
        `  oreEver=${s.oreEver.toString().slice(0, 16)}  aeonEver=${s.aeonEver.toString()}  singEver=${s.singularityEver.toString()}`,
        '  ==========================================================',
      ].join('\n'),
    );

    // ── What a one-day walk can prove ────────────────────────────────────
    // P3 opens, and the Trials that gate it are actually being cleared.
    expect(at.converge).not.toBe(NEVER);
    expect(trialTiersCleared(s)).toBeGreaterThanOrEqual(BAL.gates.convergeTrialTiers);
    // Mining is a lane the player is investing in, not a finished list.
    expect(s.oreEver.gt(1e6)).toBe(true);

    // Nothing may go non-finite across days of play.
    for (const v of [s.spark, s.motes, s.shards, s.prism, s.aeon, s.singularity, s.ore]) {
      expect(Number.isNaN(v.mantissa)).toBe(false);
    }

    /*
     * P3 must keep BEATING, not just open once. This is the regression the
     * previous balance pass was really about: the ladder opened P3 on schedule
     * and then seized, which is every hour after the first evening spent
     * watching a number that will not move. First-reach times alone cannot see
     * that, so assert the pulse.
     *
     * Late gaps are ALLOWED to be long — a month-long game is supposed to get
     * harder, and a Converge that costs a day at hour 400 is the intended
     * shape. What is not allowed is a gap that never closes.
     */
    if (HOURS >= 100) {
      expect(at.convergeEvery.length).toBeGreaterThanOrEqual(8);
      expect(Math.max(...convergeGaps)).toBeLessThan(48 * 3600);
    }

    /*
     * The endgame, asserted only by a walk long enough to have seen it. Unify
     * is the "you have now seen the whole game" moment: far enough away that
     * the first evening is not the whole game, near enough that it is not a
     * myth. Everything after it — the rest of the Trials and the Meta Shop —
     * is the back three weeks.
     */
    if (HOURS >= 400) {
      expect(at.unify).not.toBe(NEVER);
      expect(at.unify).toBeGreaterThan(48 * 3600);
      expect(at.unify).toBeLessThan(400 * 3600);
      expect(trialTiersCleared(s)).toBeGreaterThanOrEqual(BAL.gates.unifyTrialTiers);
    }
  }, LONGWALK_TIMEOUT_MS);
});
