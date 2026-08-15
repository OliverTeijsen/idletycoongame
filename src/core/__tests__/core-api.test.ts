/**
 * Coverage for the rest of the core's public surface: serialization (which
 * services/storage.ts will sit on directly), lookups, guards, and the
 * partial-progress paths of advance().
 */
import * as core from '../index';
import { D, Decimal, ZERO, decFromString, decToString, formatPercent } from '../numbers';
import { BOOST_DURATION_MS, assertDecimal, getDef, getIndex } from '../businesses';
import { businessPerSecond, getBusiness, lifetimeForInvestors, investorsForLifetime } from '../economy';
import {
  activateBoost,
  advance,
  applyOffline,
  collect,
  createInitialState,
  hireManager,
  offlineEarnings,
  setBuyAmount,
  tap,
  touch,
} from '../engine';
import type { BusinessId, GameState } from '../types';

describe('Decimal serialization', () => {
  it('round-trips values of every magnitude', () => {
    for (const raw of ['0', '4', '44444.5', '1e21', '1.7976931348623157e308', '1e5000']) {
      const parsed = decFromString(raw);
      const round = decFromString(decToString(parsed));
      expect(round.eq(parsed)).toBe(true);
    }
  });

  it('survives the values a real save would hold', () => {
    const state = createInitialState(0);
    const earned = advance(
      { ...state, businesses: state.businesses.map((b) => ({ ...b, owned: 500, managed: true })) },
      1e6,
    ).earned;
    expect(decFromString(decToString(earned)).eq(earned)).toBe(true);
  });

  it('degrades to zero on missing or corrupt input rather than throwing', () => {
    expect(decFromString(null).eq(ZERO)).toBe(true);
    expect(decFromString(undefined).eq(ZERO)).toBe(true);
    expect(decFromString('').eq(ZERO)).toBe(true);
    expect(decFromString('not-a-number').eq(ZERO)).toBe(true);
  });

  it('accepts a Decimal, number or string through D()', () => {
    expect(D(5).eq(D('5'))).toBe(true);
    const d = new Decimal(7);
    expect(D(d)).toBe(d);
  });
});

describe('formatting extras', () => {
  it('formats percentages', () => {
    expect(formatPercent(0.02)).toBe('+2%');
    expect(formatPercent(1.5)).toBe('+150%');
    expect(formatPercent(0.025, 1)).toBe('+2.5%');
  });
});

describe('lookups and guards', () => {
  it('resolves definitions and indices by id', () => {
    expect(getDef('friet').name).toBe('Fry Shack');
    expect(getIndex('friet')).toBe(0);
    expect(getIndex('empire')).toBe(9);
  });

  it('throws on an unknown business id — always a bug, never silent', () => {
    const bogus = 'kroket' as BusinessId;
    expect(() => getDef(bogus)).toThrow(/Unknown business id/);
    expect(() => getIndex(bogus)).toThrow(/Unknown business id/);
    expect(() => getBusiness(createInitialState(0), bogus)).toThrow(/Unknown business id/);
  });

  it('rejects money that is not a Decimal', () => {
    expect(() => assertDecimal(D(1), 'cash')).not.toThrow();
    expect(() => assertDecimal(1, 'cash')).toThrow(/must be a Decimal/);
    expect(() => assertDecimal('1', 'cash')).toThrow(/must be a Decimal/);
  });

  it('reports a single business rate regardless of automation', () => {
    const state = createInitialState(0);
    // 1 Frietkot: 3 per 1.5s cycle == 2/s, even though nothing is automated yet.
    expect(businessPerSecond(state, 'friet').eq(D(2))).toBe(true);
    expect(core.perSecond(state).eq(ZERO)).toBe(true);
  });

  it('inverts the prestige formula for progress hints', () => {
    for (const investors of [1, 150, 3000]) {
      const needed = lifetimeForInvestors(investors);
      expect(investorsForLifetime(needed)).toBe(investors);
    }
  });
});

describe('advance — partial progress and merged payouts', () => {
  it('carries partial progress on a tapped business between ticks', () => {
    const base = createInitialState(0);
    let state = tap(base, 'friet');

    state = advance(state, 0.5).state; // 1/3 of a 1.5s cycle
    expect(getBusiness(state, 'friet').progress).toBeCloseTo(1 / 3, 9);
    expect(getBusiness(state, 'friet').active).toBe(true);
    expect(state.cash.eq(ZERO)).toBe(true);

    state = advance(state, 0.5).state;
    expect(getBusiness(state, 'friet').progress).toBeCloseTo(2 / 3, 9);
    expect(state.cash.eq(ZERO)).toBe(true);

    const done = advance(state, 0.5);
    expect(done.state.cash.eq(D(3))).toBe(true);
    expect(getBusiness(done.state, 'friet').active).toBe(false);
  });

  it('merges payouts across a boost split, including tiers that only pay after it', () => {
    let state: GameState = createInitialState(0);
    state = {
      ...state,
      businesses: state.businesses.map((b) =>
        b.id === 'friet'
          ? { ...b, owned: 1, managed: true }
          : b.id === 'wafel'
            ? { ...b, owned: 1, managed: true, progress: 0 }
            : b,
      ),
    };
    state = activateBoost(state, 2000); // 2s of ×2

    // 4s total: friet (1.5s cycle) pays in both slices, wafel (3s) only in the second.
    const { payouts, earned } = advance(state, 4);
    const ids = payouts.map((p) => p.id).sort();
    expect(ids).toEqual(['friet', 'wafel']);

    const friet = payouts.find((p) => p.id === 'friet')!;
    const wafel = payouts.find((p) => p.id === 'wafel')!;
    expect(friet.cycles).toBe(2); // one boosted at t=1.5s, one plain at t=3.0s
    expect(wafel.cycles).toBe(1); // at t=3.0s, un-boosted
    expect(friet.amount.eq(D(3 * 2).add(3))).toBe(true);
    expect(wafel.amount.eq(D(60))).toBe(true);
    expect(earned.eq(friet.amount.add(wafel.amount))).toBe(true);
  });

  it('leaves the boost running when the step is shorter than it', () => {
    const state = activateBoost(createInitialState(0));
    const after = advance(state, 1).state;
    expect(after.boostRemainingMs).toBe(BOOST_DURATION_MS - 1000);
    expect(after.boostMultiplier).toBe(2);
  });

  it('ignores a non-positive boost duration', () => {
    const state = createInitialState(0);
    expect(activateBoost(state, 0)).toBe(state);
    expect(activateBoost(state, -1)).toBe(state);
    expect(activateBoost(state, Number.NaN)).toBe(state);
  });
});

describe('small state actions', () => {
  it('collect ignores non-positive amounts and credits lifetime earnings', () => {
    const state = createInitialState(0);
    expect(collect(state, ZERO)).toBe(state);
    expect(collect(state, D(-5))).toBe(state);

    const after = collect(state, D(100));
    expect(after.cash.eq(D(100))).toBe(true);
    expect(after.lifetimeEarnings.eq(D(100))).toBe(true);
  });

  it('setBuyAmount is a no-op when the toggle is unchanged', () => {
    const state = createInitialState(0);
    expect(setBuyAmount(state, 1)).toBe(state);
    expect(setBuyAmount(state, 'MAX').buyAmount).toBe('MAX');
  });

  it('touch re-anchors the offline clock without touching money', () => {
    const state = createInitialState(0);
    const after = touch(state, 12_345);
    expect(after.lastActiveAt).toBe(12_345);
    expect(after.cash.eq(state.cash)).toBe(true);
    expect(state.lastActiveAt).toBe(0);
  });

  it('applyOffline re-anchors the clock even when nothing was earned', () => {
    const state = { ...createInitialState(0), lastActiveAt: 0 };
    const result = offlineEarnings(state, 3600); // nothing automated -> zero
    expect(result.amount.eq(ZERO)).toBe(true);

    const after = applyOffline(state, result, 1, 9_000);
    expect(after.lastActiveAt).toBe(9_000);
    expect(after.cash.eq(ZERO)).toBe(true);
    expect(after).not.toBe(state);
  });

  it('hiring a manager clears an in-flight manual cycle', () => {
    let state = { ...createInitialState(0), cash: getDef('friet').managerCost };
    state = tap(state, 'friet');
    expect(getBusiness(state, 'friet').active).toBe(true);

    state = hireManager(state, 'friet');
    expect(getBusiness(state, 'friet').active).toBe(false);
    expect(getBusiness(state, 'friet').managed).toBe(true);
  });
});

describe('barrel export', () => {
  it('exposes the whole core through src/core/index.ts', () => {
    for (const name of [
      'createInitialState',
      'advance',
      'buy',
      'hireManager',
      'tap',
      'prestige',
      'offlineEarnings',
      'collect',
      'formatBig',
      'money',
      'BUSINESSES',
      'MILESTONES',
      'MILESTONE_STEP',
      'PERKS',
      'buyPerk',
    ]) {
      expect(core).toHaveProperty(name);
    }
  });
});
