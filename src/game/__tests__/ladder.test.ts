/**
 * The ladder balance report (spec §18 Phase 10).
 *
 * Walks a single save from a fresh start all the way up the prestige ladder
 * with a "reasonably good idle player" model, and logs when each layer first
 * opens. These numbers are the input to tuning  — the assertions
 * are the §10 pacing targets, so a future balance change that breaks the
 * intended shape of the game fails here instead of being discovered by a
 * player forty hours in.
 *
 * Times are BOT-seconds. The bot buys optimally every second from minute one,
 * which a human does not manage before automation unlocks, so early-game
 * numbers here run roughly 2× faster than a real first session. After P1 the
 * autobuyers do the same thing the bot does, so later numbers are honest.
 *
 * The player model itself lives in harness.ts — see the note there for why.
 */
import { BAL } from '../balance';
import { D } from '../numbers';
import { defaultState } from '../state';
import { singularityMult } from '../systems/multipliers';
import {
  canConverge,
  canUnify,
  convergeGain,
  doConverge,
  doUnify,
} from '../systems/prestige';
import { LADDER_TIMEOUT_MS, NEVER, hours, mins, walkLadder } from './harness';

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
        `  Converges at : ${at.convergeEvery.map(hours).join(', ') || 'none'}`,
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
    // (Measured, the first Unify lands around 8.4h — past this walk, reached.)
    expect(at.unify).toBe(NEVER);

    /**
     * P3 must keep BEATING, not just open once.
     *
     * This is the regression that the Phase 11 pass was really about: with the
     * old log2 Converge gain and a flat 0.25–0.34 "worth taking" rule, the
     * ladder opened P3 on schedule and then seized — the 4th Converge landed
     * at 5.9h and the 5th never came at all inside fourteen hours, which is
     * every hour after the first evening spent watching a number that will
     * not move. First-reach times alone cannot see that, so assert the pulse.
     */
    expect(at.convergeEvery.length).toBeGreaterThanOrEqual(4);
    const gaps = at.convergeEvery.map((t, i) => t - (i === 0 ? 0 : at.convergeEvery[i - 1]));
    expect(Math.max(...gaps)).toBeLessThan(2 * 3600);

    // Re-clearing P1 after an Ascend must be 3–10× faster than the first climb.
    expect(at.reclearP1).toBeGreaterThan(0);
    expect(at.reclearP1 * 3).toBeLessThan(at.ascend);

    // Nothing may go non-finite across the whole walk.
    for (const v of [s.spark, s.motes, s.shards, s.prism, s.aeon, s.singularity, s.ore]) {
      expect(Number.isNaN(v.mantissa)).toBe(false);
    }
  }, LADDER_TIMEOUT_MS);

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
