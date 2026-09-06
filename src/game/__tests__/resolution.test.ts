/**
 * CALIBRATION: what does the coarse walk cost in accuracy?
 *
 * `longwalk.test.ts` has to simulate a month, so it runs at one tick per
 * simulated second and shops every tenth second; `ladder.test.ts` runs the
 * same player at five ticks and shops every fourth second. Those are not the
 * same game — a coarse Euler step under-integrates the dimension cascade (each
 * tier feeds the one below it WITHIN a tick, so fewer, larger steps compound
 * less), and a bot that shops less often leaves purchases on the table.
 *
 * Both effects push the same way: the coarse walk reads SLOWER than the real
 * 20-tick game. That is the safe direction for a pacing floor, but only if you
 * know the size of it — otherwise the month-long report is being read as if it
 * were minutes-accurate, and the game ships three times faster than intended.
 *
 * This test measures the factor and prints it, so the long report can be read
 * correctly, and fails if it ever grows large enough to make that report
 * meaningless.
 */
import { LADDER_TIMEOUT_MS, NEVER, hours, mins, walkLadder } from './harness';

describe('simulation resolution', () => {
  it('the coarse walk is slower than the fine one, by a known and bounded factor', () => {
    const HORIZON = 6 * 3600;

    const fine = walkLadder(HORIZON, undefined, { ticksPerSec: 5, shopEvery: 4 });
    const coarse = walkLadder(HORIZON, undefined, { ticksPerSec: 1, shopEvery: 10 });

    const ratio = (a: number, b: number) => (a === NEVER || b === NEVER ? NaN : b / a);
    const collapseFactor = ratio(fine.at.collapse, coarse.at.collapse);
    const ascendFactor = ratio(fine.at.ascend, coarse.at.ascend);

    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '  ===== RESOLUTION CALIBRATION (6h horizon) =====',
        `  fine   (5 ticks/s, shop/4s): Collapse ${mins(fine.at.collapse)}  Ascend ${mins(
          fine.at.ascend,
        )}  Converge ${hours(fine.at.converge)}`,
        `  coarse (1 tick/s,  shop/10s): Collapse ${mins(coarse.at.collapse)}  Ascend ${mins(
          coarse.at.ascend,
        )}  Converge ${hours(coarse.at.converge)}`,
        `  coarse/fine: collapse ×${collapseFactor.toFixed(2)}  ascend ×${ascendFactor.toFixed(2)}`,
        '  ===============================================',
      ].join('\n'),
    );

    // The coarse walk must never read FASTER — that would make the long report
    // an optimistic one, and an optimistic pacing floor is worthless.
    expect(coarse.at.collapse).toBeGreaterThanOrEqual(fine.at.collapse);
    expect(coarse.at.ascend).toBeGreaterThanOrEqual(fine.at.ascend);

    // And it must stay within a factor the long report can be read through.
    expect(ascendFactor).toBeLessThan(6);
  }, LADDER_TIMEOUT_MS);
});
