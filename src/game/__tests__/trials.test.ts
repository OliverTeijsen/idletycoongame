/**
 * The trials balance report (spec §8.4).
 *
 * Its own file, not a second report inside ladder.test.ts, so it gets its own
 * jest worker and its own heap — see the note in harness.ts.
 */
import { BAL } from '../balance';
import { deserializeState, serializeState } from '../save';
import { challengeGoal, enterChallenge } from '../systems/challenges';
import { LADDER_TIMEOUT_MS, NEVER, mins, playSecond, walkLadder } from './harness';

/**
 * Are the trials actually trials? (spec §8.4)
 *
 * This is the harness the challenge goals in BAL.challenges were calibrated
 * on, kept in the repo because those goals are unreadable without it: 1e1400
 * for Brittle against 1e7 for Solitary looks like a typo until you have seen
 * the two curves side by side. It walks a fresh save to the first Ascend —
 * the moment Trials unlock — then runs each challenge's tier 1 for real and
 * times it.
 *
 * The regression it guards is the one a fixed goal always drifts into: the
 * player's permanent multipliers grow without bound while the goal does not,
 * so a trial that was a ten-minute run at unlock becomes a sixty-second
 * formality a layer later. Measured on the previous shared 3e6–1e7 goals,
 * every tier 1 fell in 60–530 seconds and the run at first Converge was
 * FASTER than the run at first Ascend.
 */
describe('the trials (balance report)', () => {
  it('tier 1 of every trial is a real run at the moment it unlocks', () => {
    const { s: atAscend } = walkLadder(3 * 3600, (st) => st.ascends >= 1);
    expect(atAscend.ascends).toBeGreaterThanOrEqual(1);

    const lines: string[] = [];
    for (const def of BAL.challenges.defs) {
      // Deep-clone through the save codec: every Decimal has to survive.
      const c = deserializeState(serializeState(atAscend), 0)!;
      c.challenges = {};
      expect(enterChallenge(c, def.id)).toBe(true);

      let done = NEVER;
      for (let sec = 1; sec <= 45 * 60; sec++) {
        playSecond(c, false, true);
        if (c.activeChallenge === null) {
          done = sec;
          break;
        }
      }
      lines.push(`  ${def.id.padEnd(10)} goal ${challengeGoal(atAscend, def.id).toString().padEnd(10)} tier 1 in ${mins(done)}`);

      // A trial has to cost a real sitting the day it opens...
      expect(done).toBeGreaterThan(4 * 60);
      // ...and still be finishable in one, or nobody ever runs the other four.
      expect(done).toBeLessThan(20 * 60);
    }
    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '  ===== TRIAL TIMES AT FIRST ASCEND (bot-seconds) =====',
        ...lines,
        '  =====================================================',
      ].join('\n'),
    );
  }, LADDER_TIMEOUT_MS);
});
