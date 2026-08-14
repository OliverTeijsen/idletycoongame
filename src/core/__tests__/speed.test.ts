/**
 * Speed milestones: the mechanic that turns a tier from "automatic" into
 * "constant".
 *
 * The invariant that matters most is at the bottom — `advance()` and
 * `perSecond()` must agree. They compute income by different routes, and a
 * speed-up that only one of them knows about would show the player a rate the
 * game does not actually pay.
 */
import {
  CONTINUOUS_CYCLE_SECONDS,
  MIN_CYCLE_SECONDS,
  SPEED_MILESTONES,
  getDef,
} from '../businesses';
import {
  businessPerSecond,
  cycleTimeFor,
  isContinuous,
  nextSpeedMilestone,
  perSecond,
  speedCount,
  unitsToNextSpeed,
} from '../economy';
import { advance, createInitialState } from '../engine';
import type { BusinessId, GameState } from '../types';

const FRIET = getDef('friet');

function owning(id: BusinessId, owned: number, managed = true): GameState {
  const base = createInitialState(0);
  return {
    ...base,
    businesses: base.businesses.map((b) => (b.id === id ? { ...b, owned, managed } : b)),
  };
}

describe('speedCount', () => {
  it('is zero below the first threshold', () => {
    expect(speedCount(0)).toBe(0);
    expect(speedCount(SPEED_MILESTONES[0] - 1)).toBe(0);
  });

  it('counts each threshold passed', () => {
    expect(speedCount(SPEED_MILESTONES[0])).toBe(1);
    expect(speedCount(SPEED_MILESTONES[1])).toBe(2);
    expect(speedCount(9_999)).toBe(SPEED_MILESTONES.length);
  });
});

describe('cycleTimeFor', () => {
  it('is the raw cycle time before any threshold', () => {
    expect(cycleTimeFor(FRIET, 1)).toBe(FRIET.cycleTime);
  });

  it('halves at each threshold', () => {
    expect(cycleTimeFor(FRIET, SPEED_MILESTONES[0])).toBeCloseTo(FRIET.cycleTime / 2);
    expect(cycleTimeFor(FRIET, SPEED_MILESTONES[1])).toBeCloseTo(FRIET.cycleTime / 4);
  });

  it('never goes below the floor, however many units are owned', () => {
    const fastest = cycleTimeFor(FRIET, 1e9);
    expect(fastest).toBeGreaterThanOrEqual(MIN_CYCLE_SECONDS);
  });

  it('leaves the slowest tier still slow — this is not a shortcut to the end', () => {
    const empire = getDef('empire');
    // 768s over five halvings is still 24s: late tiers stay a commitment.
    expect(cycleTimeFor(empire, 9_999)).toBeGreaterThan(20);
  });
});

describe('isContinuous', () => {
  it('is false for a tier nobody owns', () => {
    expect(isContinuous(FRIET, 0)).toBe(false);
  });

  it('is false while the bar can still be drawn honestly', () => {
    expect(isContinuous(FRIET, 1)).toBe(false);
  });

  it('becomes true once the cycle outruns the tick', () => {
    const owned = SPEED_MILESTONES[SPEED_MILESTONES.length - 1];
    expect(cycleTimeFor(FRIET, owned)).toBeLessThanOrEqual(CONTINUOUS_CYCLE_SECONDS);
    expect(isContinuous(FRIET, owned)).toBe(true);
  });

  it('reaches continuous for the starting tier within a reachable count', () => {
    // The player must actually be able to see this happen on tier one.
    expect(isContinuous(FRIET, 300)).toBe(true);
  });
});

describe('next speed milestone', () => {
  it('points at the next threshold', () => {
    expect(nextSpeedMilestone(0)).toBe(SPEED_MILESTONES[0]);
    expect(unitsToNextSpeed(0)).toBe(SPEED_MILESTONES[0]);
  });

  it('is null once every threshold is passed', () => {
    expect(nextSpeedMilestone(9_999)).toBeNull();
    expect(unitsToNextSpeed(9_999)).toBeNull();
  });
});

describe('income', () => {
  it('doubles across a speed threshold, on top of the profit milestone', () => {
    const before = businessPerSecond(owning('friet', SPEED_MILESTONES[0] - 1), 'friet');
    const after = businessPerSecond(owning('friet', SPEED_MILESTONES[0]), 'friet');
    // One more unit, one profit milestone (25) and one speed milestone (25).
    expect(after.div(before).toNumber()).toBeGreaterThan(3);
  });

  // The important one: the rate shown to the player is the rate actually paid.
  it.each([1, 24, 25, 99, 100, 250, 500])(
    'advance() pays exactly what perSecond() advertises at %s owned',
    (owned) => {
      const state = owning('friet', owned);
      const rate = perSecond(state);

      const seconds = 600;
      const { earned } = advance(state, seconds);
      const expected = rate.mul(seconds);

      // Only the partial cycle left running at the end separates them.
      const drift = earned.sub(expected).abs().div(expected).toNumber();
      expect(drift).toBeLessThan(0.001);
    },
  );

  it('pays a continuous tier every tick, with nothing left stalling', () => {
    const state = owning('friet', 400);
    // A single 100ms tick must complete whole cycles at this speed.
    const { payouts, earned } = advance(state, 0.1);
    expect(payouts).toHaveLength(1);
    expect(payouts[0].cycles).toBeGreaterThan(1);
    expect(earned.gt(0)).toBe(true);
  });
});
