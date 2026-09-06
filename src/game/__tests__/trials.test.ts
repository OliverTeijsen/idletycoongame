/**
 * The trials balance report (spec §8.4).
 *
 * Its own file, not a second report inside ladder.test.ts, so it gets its own
 * jest worker and its own heap — see the note in harness.ts.
 *
 * TRIALS ARE NOW LOAD-BEARING. Since the Phase 12 rebalance, cleared tiers
 * gate Converge (5) and Unify (15), so a Trial curve that outruns the player
 * is not a difficulty setting, it is a hard stop on the whole game. This
 * report is what stands between that and a player forty hours in.
 */
import { BAL } from '../balance';
import { deserializeState, serializeState } from '../save';
import { challengeGoal, enterChallenge } from '../systems/challenges';
import { LADDER_TIMEOUT_MS, NEVER, mins, playSecond, walkLadder } from './harness';
import { GameState } from '../types';

/**
 * A clean copy of a save, with any Trial the walk happened to be sitting in
 * cleared. The walk enters one the moment Ascend lands (Trials gate Converge,
 * so a sensible player goes straight there), and a state that is already
 * inside a Trial cannot enter another.
 */
function freshCopy(from: GameState): GameState {
  const c = deserializeState(serializeState(from), 0)!;
  c.challenges = {};
  c.activeChallenge = null;
  c.challengeElapsed = 0;
  return c;
}

/** Run one Trial to completion (or give up). Returns seconds, or NEVER. */
function runTrial(c: GameState, id: string, budgetSeconds: number): number {
  if (!enterChallenge(c, id)) return NEVER;
  for (let sec = 1; sec <= budgetSeconds; sec++) {
    playSecond(c, false, true);
    if (c.activeChallenge === null) return sec;
  }
  return NEVER;
}

describe('the trials (balance report)', () => {
  /**
   * Are the trials actually trials? (spec §8.4)
   *
   * This is the harness the challenge goals in BAL.challenges were calibrated
   * on, kept in the repo because those goals are unreadable without it: 1e1400
   * for Brittle against 1e8 for Solitary looks like a typo until you have seen
   * the two curves side by side. It walks a fresh save to the first Ascend —
   * the moment Trials unlock — then runs each challenge's tier 1 for real and
   * times it.
   *
   * The regression it guards is the one a fixed goal always drifts into: the
   * player's permanent multipliers grow without bound while the goal does not,
   * so a trial that was a ten-minute run at unlock becomes a sixty-second
   * formality a layer later.
   */
  it('tier 1 of every trial is a real run at the moment it unlocks', () => {
    const { s: atAscend } = walkLadder(4 * 3600, (st) => st.ascends >= 1);
    expect(atAscend.ascends).toBeGreaterThanOrEqual(1);

    // Measure every trial BEFORE asserting anything. This is a report first
    // and a test second, and a report that stops printing the moment one row
    // is out of range is exactly the report you need when a row is out of
    // range.
    const times = BAL.challenges.defs.map((def) => ({
      def,
      seconds: runTrial(freshCopy(atAscend), def.id, 45 * 60),
    }));

    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '  ===== TRIAL TIMES AT FIRST ASCEND (bot-seconds) =====',
        ...times.map(
          ({ def, seconds }) =>
            `  ${def.id.padEnd(10)} goal ${challengeGoal(atAscend, def.id)
              .toString()
              .padEnd(12)} tier 1 in ${mins(seconds)}`,
        ),
        '  =====================================================',
      ].join('\n'),
    );

    for (const { def, seconds } of times) {
      // Paired with the id so a failure names the trial, not just a number.
      // A trial has to cost a real sitting the day it opens...
      expect({ id: def.id, tooFast: seconds < 2 * 60 }).toEqual({
        id: def.id,
        tooFast: false,
      });
      // ...and still be finishable in one, or nobody ever runs the other four.
      expect({ id: def.id, tooSlow: seconds === NEVER || seconds > 30 * 60 }).toEqual({
        id: def.id,
        tooSlow: false,
      });
    }
  }, LADDER_TIMEOUT_MS);

  /**
   * The Converge gate has to be PASSABLE IN THE ORDINARY FLOW OF PLAY.
   *
   * Converge needs five cleared tiers out of forty, and each tier's goal is
   * `goalBase · goalGrowth^tiersDone` — steep enough to keep the later tiers
   * meaningful and, if it is mis-set, steep enough to wall the whole endgame
   * off. What makes it passable is not that five tiers fall back-to-back at
   * first-Ascend power (they do not, and should not); it is that the player
   * GROWS between them. So this asserts the thing that actually matters: a bot
   * playing the game normally clears the gate and reaches P3, and does it in
   * the first day rather than the first week.
   */
  it('a normal player clears the Converge gate in the first day', () => {
    const { s, at } = walkLadder(30 * 3600, (st) => st.converges >= 1, {
      ticksPerSec: 2,
      shopEvery: 6,
    });

    // eslint-disable-next-line no-console
    console.log(
      `  [trials] first Trial at ${mins(at.trial)}, Converge gate (${
        BAL.gates.convergeTrialTiers
      } tiers) cleared with ${at.trialTiers} tiers, Converge at ${mins(at.converge)}`,
    );

    expect(s.challenges).toBeDefined();
    expect(at.trialTiers).toBeGreaterThanOrEqual(BAL.gates.convergeTrialTiers);
    expect(at.converge).not.toBe(NEVER);
    expect(at.converge).toBeLessThan(30 * 3600);
  }, LADDER_TIMEOUT_MS);
});
