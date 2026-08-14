/**
 * Economy core test suite (spec §12).
 *
 * These tests are the contract for the whole game: the UI, the store and any
 * future server-side validation all sit on top of this math.
 */
import fs from 'fs';
import path from 'path';

import { D, Decimal, ZERO, formatBig, formatTime, money, moneyPerSecond } from '../numbers';
import {
  BOOST_DURATION_MS,
  BOOST_MULTIPLIER,
  BUSINESSES,
  COST_MULTIPLIER,
  GOLDEN_MULTIPLIER,
  INVESTOR_BONUS,
  MILESTONES,
  OFFLINE_CAP_SECONDS,
  getDef,
} from '../businesses';
import {
  buyCost,
  canAfford,
  canPrestige,
  costForAmount,
  costOfNext,
  cycleRevenue,
  getBusiness,
  globalMultiplier,
  investorsForLifetime,
  maxBuy,
  milestoneMult,
  nextMilestone,
  perSecond,
  prestigeGain,
  resolveBuyCount,
  unitsToNextMilestone,
} from '../economy';
import {
  activateBoost,
  activateGoldenBoost,
  advance,
  applyOffline,
  buy,
  collect,
  createInitialState,
  hireManager,
  offlineEarnings,
  offlineEarningsSince,
  prestige,
  setBuyAmount,
  tap,
} from '../engine';
import type { BusinessId, GameState } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FRIET = getDef('friet');

/** Relative-tolerance comparison — Decimal keeps ~15 significant digits. */
function expectClose(actual: Decimal, expected: Decimal | number | string, rel = 1e-9): void {
  const e = D(expected);
  if (e.eq(ZERO)) {
    expect(actual.abs().lt(1e-6)).toBe(true);
    return;
  }
  const diff = actual.sub(e).abs().div(e.abs()).toNumber();
  expect(diff).toBeLessThan(rel);
}

/** A state with cash, and optional per-business overrides. */
function stateWith(
  overrides: Partial<GameState> = {},
  businesses: Partial<Record<BusinessId, Partial<{ owned: number; managed: boolean; active: boolean; progress: number }>>> = {},
): GameState {
  const state: GameState = { ...createInitialState(0), ...overrides };
  state.businesses = state.businesses.map((bs) => ({ ...bs, ...(businesses[bs.id] ?? {}) }));
  return state;
}

/** Naive reference implementation of maxBuy, used to check the analytic one. */
function bruteMaxBuy(owned: number, cash: Decimal, def = FRIET): number {
  let k = 0;
  while (k < 3000 && buyCost(def, owned, k + 1).lte(cash)) k += 1;
  return k;
}

// ---------------------------------------------------------------------------

describe('numbers', () => {
  it('formats small values with two decimals only when fractional', () => {
    expect(formatBig(0)).toBe('0');
    expect(formatBig(4)).toBe('4');
    expect(formatBig(4.5)).toBe('4.50');
    expect(formatBig(-4.5)).toBe('-4.50');
  });

  it('formats big values with short-scale suffixes', () => {
    expect(formatBig(1234)).toBe('1.23K');
    expect(formatBig(1e6)).toBe('1.00M');
    expect(formatBig(1.5e9)).toBe('1.50B');
    expect(formatBig(1e12)).toBe('1.00T');
    expect(formatBig(D('1e33'))).toBe('1.00Dc');
  });

  it('promotes a value that rounds up into the next tier', () => {
    expect(formatBig(999.999)).toBe('1.00K');
    expect(formatBig(999999.9)).toBe('1.00M');
  });

  it('falls back to scientific notation past the suffix table', () => {
    expect(formatBig(D('1e100'))).toBe('1.00e100');
  });

  it('formats money and rates', () => {
    expect(money(1234)).toBe('€1.23K');
    expect(moneyPerSecond(1e6)).toBe('€1.00M/s');
  });

  it('formats durations', () => {
    expect(formatTime(1.5)).toBe('1.5s');
    expect(formatTime(12)).toBe('12s');
    expect(formatTime(96)).toBe('1m 36s');
    expect(formatTime(OFFLINE_CAP_SECONDS)).toBe('12h 00m');
    expect(formatTime(90000)).toBe('1d 1h');
  });

  it('keeps money precise far past Number.MAX_SAFE_INTEGER', () => {
    const huge = D('1e120').mul(3);
    expectClose(huge.add(huge), D('6e120'));
  });
});

describe('cost curve', () => {
  it('grows the single-unit cost by exactly ×1.10 per owned unit', () => {
    for (let owned = 0; owned < 50; owned += 1) {
      const here = costOfNext(FRIET, owned);
      const next = costOfNext(FRIET, owned + 1);
      expectClose(next, here.mul(COST_MULTIPLIER));
    }
  });

  it('starts at baseCost for the first unit', () => {
    for (const def of BUSINESSES) {
      expectClose(costOfNext(def, 0), def.baseCost);
      expectClose(buyCost(def, 0, 1), def.baseCost);
    }
  });

  it('buyCost(k) equals the sum of k single-unit costs', () => {
    for (const def of [FRIET, getDef('brouw'), getDef('empire')]) {
      for (const owned of [0, 7, 137]) {
        for (const k of [1, 2, 10, 100]) {
          let sum = ZERO;
          for (let i = 0; i < k; i += 1) sum = sum.add(costOfNext(def, owned + i));
          expectClose(buyCost(def, owned, k), sum);
        }
      }
    }
  });

  it('returns zero for a non-positive count', () => {
    expect(buyCost(FRIET, 0, 0).eq(ZERO)).toBe(true);
    expect(buyCost(FRIET, 0, -5).eq(ZERO)).toBe(true);
  });
});

describe('maxBuy', () => {
  it('returns 0 when the next unit is unaffordable', () => {
    expect(maxBuy(FRIET, 0, D(0))).toBe(0);
    expect(maxBuy(FRIET, 0, D(3.99))).toBe(0);
    expect(maxBuy(FRIET, 0, D(-10))).toBe(0);
  });

  it('returns exactly 1 at the price of the first unit', () => {
    expect(maxBuy(FRIET, 0, FRIET.baseCost)).toBe(1);
  });

  it('matches a brute-force search across many cash levels and owned counts', () => {
    const cashLevels = [4, 8.4, 13.24, 100, 1_000, 12_345, 1e6, 1e9, 1e15];
    for (const owned of [0, 1, 5, 24, 25, 99, 250]) {
      for (const cash of cashLevels) {
        const c = D(cash);
        expect(maxBuy(FRIET, owned, c)).toBe(bruteMaxBuy(owned, c));
      }
    }
  });

  it('never over-spends and is maximal, even at astronomic cash', () => {
    for (const def of BUSINESSES) {
      for (const cash of [D('1e21'), D('1e60'), D('1e200')]) {
        for (const owned of [0, 42, 501]) {
          const k = maxBuy(def, owned, cash);
          expect(buyCost(def, owned, k).lte(cash)).toBe(true);
          expect(buyCost(def, owned, k + 1).gt(cash)).toBe(true);
        }
      }
    }
  });
});

describe('milestones', () => {
  it('doubles the multiplier at each threshold', () => {
    expect(milestoneMult(0)).toBe(1);
    expect(milestoneMult(24)).toBe(1);
    MILESTONES.forEach((threshold, i) => {
      expect(milestoneMult(threshold - 1)).toBe(Math.pow(2, i));
      expect(milestoneMult(threshold)).toBe(Math.pow(2, i + 1));
    });
  });

  it('caps at 2^10 once every milestone is passed', () => {
    expect(milestoneMult(1000)).toBe(1024);
    expect(milestoneMult(99999)).toBe(1024);
  });

  it('reports the next threshold and the distance to it', () => {
    expect(nextMilestone(0)).toBe(25);
    expect(nextMilestone(25)).toBe(50);
    expect(nextMilestone(1000)).toBeNull();
    expect(unitsToNextMilestone(10)).toBe(15);
    expect(unitsToNextMilestone(1000)).toBeNull();
  });

  it('feeds straight into cycle revenue', () => {
    const at24 = stateWith({}, { friet: { owned: 24 } });
    const at25 = stateWith({}, { friet: { owned: 25 } });
    // 25 units = 25/24 more units AND a ×2 milestone.
    expectClose(cycleRevenue(at24, 'friet'), D(3).mul(24));
    expectClose(cycleRevenue(at25, 'friet'), D(3).mul(25).mul(2));
  });
});

describe('global multiplier', () => {
  it('grants +2% per investor', () => {
    expect(globalMultiplier(stateWith({ investors: 0 }))).toBeCloseTo(1, 12);
    expect(globalMultiplier(stateWith({ investors: 1 }))).toBeCloseTo(1 + INVESTOR_BONUS, 12);
    expect(globalMultiplier(stateWith({ investors: 50 }))).toBeCloseTo(2, 12);
    expect(globalMultiplier(stateWith({ investors: 250 }))).toBeCloseTo(6, 12);
  });

  it('doubles while the boost is active and stacks with investors', () => {
    const boosted = activateBoost(stateWith({ investors: 50 }));
    expect(globalMultiplier(boosted)).toBeCloseTo(4, 12);
  });

  it('uses the golden frietzak multiplier when that boost is running', () => {
    const golden = activateGoldenBoost(stateWith());
    expect(globalMultiplier(golden)).toBeCloseTo(GOLDEN_MULTIPLIER, 12);
  });

  it('keeps the stronger multiplier and stacks the durations', () => {
    let s = activateGoldenBoost(stateWith());
    s = activateBoost(s, BOOST_DURATION_MS, BOOST_MULTIPLIER);
    expect(s.boostMultiplier).toBe(GOLDEN_MULTIPLIER);
    expect(s.boostRemainingMs).toBe(BOOST_DURATION_MS * 2);
  });

  it('expires and reverts to the default multiplier', () => {
    const s = activateGoldenBoost(stateWith());
    const after = advance(s, BOOST_DURATION_MS / 1000 + 1).state;
    expect(after.boostRemainingMs).toBe(0);
    expect(globalMultiplier(after)).toBeCloseTo(1, 12);
  });
});

describe('advance', () => {
  const managedFriet = () => stateWith({}, { friet: { owned: 1, managed: true } });

  it('pays exactly one cycle of revenue over one cycleTime', () => {
    const { earned, state } = advance(managedFriet(), FRIET.cycleTime);
    expectClose(earned, 3);
    expectClose(state.cash, 3);
    expect(state.businesses[0].progress).toBeCloseTo(0, 9);
  });

  it('pays nothing before the cycle completes', () => {
    const { earned } = advance(managedFriet(), FRIET.cycleTime * 0.99);
    expect(earned.eq(ZERO)).toBe(true);
  });

  it('accumulates a cycle correctly across many small ticks', () => {
    let state = managedFriet();
    let total = ZERO;
    // 15 ticks of 100ms == exactly one 1.5s cycle, despite float drift.
    for (let i = 0; i < 15; i += 1) {
      const r = advance(state, 0.1);
      state = r.state;
      total = total.add(r.earned);
    }
    expectClose(total, 3);
  });

  it('pays multiple cycles for a large dt (analytic catch-up)', () => {
    const { earned, payouts } = advance(managedFriet(), FRIET.cycleTime * 10);
    expectClose(earned, 30);
    expect(payouts).toHaveLength(1);
    expect(payouts[0]).toMatchObject({ id: 'friet', cycles: 10 });
  });

  it('pays nothing for an un-managed, un-tapped business', () => {
    const idle = stateWith({}, { friet: { owned: 1 } });
    expect(advance(idle, 3600).earned.eq(ZERO)).toBe(true);
  });

  it('pays nothing for a business with zero units owned', () => {
    const empty = stateWith({}, { friet: { owned: 0, managed: true } });
    expect(advance(empty, 3600).earned.eq(ZERO)).toBe(true);
  });

  it('pays a tapped business exactly one cycle, then stops', () => {
    const tapped = tap(stateWith({}, { friet: { owned: 1 } }), 'friet');
    const first = advance(tapped, FRIET.cycleTime);
    expectClose(first.earned, 3);
    expect(first.state.businesses[0].active).toBe(false);

    const second = advance(first.state, FRIET.cycleTime * 100);
    expect(second.earned.eq(ZERO)).toBe(true);
  });

  it('never pays a tapped business more than one cycle, however large the dt', () => {
    const tapped = tap(stateWith({}, { friet: { owned: 1 } }), 'friet');
    expectClose(advance(tapped, 10_000).earned, 3);
  });

  it('applies investor and boost multipliers to payouts', () => {
    const state = activateBoost(stateWith({ investors: 50 }, { friet: { owned: 1, managed: true } }));
    // 3 base × (1 + 50×2%) × 2 boost = 12
    expectClose(advance(state, FRIET.cycleTime).earned, 12);
  });

  it('splits the step at boost expiry so each portion is paid correctly', () => {
    const state = activateBoost(stateWith({}, { friet: { owned: 1, managed: true } }));
    // 30s boosted (20 cycles × 3 × 2 = 120) + 30s plain (20 cycles × 3 = 60)
    const { earned, state: after } = advance(state, 60);
    expectClose(earned, 180);
    expect(after.boostRemainingMs).toBe(0);
  });

  it('credits lifetime earnings alongside cash', () => {
    const { state } = advance(managedFriet(), FRIET.cycleTime);
    expectClose(state.lifetimeEarnings, 3);
  });

  it('is a no-op for a zero, negative or non-finite dt', () => {
    const state = managedFriet();
    for (const dt of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = advance(state, dt);
      expect(r.earned.eq(ZERO)).toBe(true);
      expect(r.state).toBe(state);
    }
  });

  it('does not mutate the input state', () => {
    const state = managedFriet();
    advance(state, 100);
    expect(state.cash.eq(ZERO)).toBe(true);
    expect(state.businesses[0].progress).toBe(0);
  });

  it('keeps object identity for businesses that cannot change', () => {
    // React rows subscribe per business — an unchanged tier must not produce a
    // new object, or every tick re-renders all ten rows for nothing.
    const state = stateWith(
      {},
      { friet: { owned: 1, managed: true }, wafel: { owned: 5 }, choco: { owned: 0 } },
    );
    const after = advance(state, 0.1).state;

    expect(after.businesses[0]).not.toBe(state.businesses[0]); // managed: progress moved
    expect(after.businesses[1]).toBe(state.businesses[1]); // owned but idle
    expect(after.businesses[2]).toBe(state.businesses[2]); // not owned
  });
});

describe('perSecond', () => {
  it('counts managed businesses only', () => {
    const state = stateWith({}, { friet: { owned: 1, managed: true }, wafel: { owned: 1 } });
    expectClose(perSecond(state), D(3).div(1.5));
  });

  it('sums every managed tier', () => {
    const state = stateWith(
      {},
      { friet: { owned: 1, managed: true }, wafel: { owned: 1, managed: true } },
    );
    expectClose(perSecond(state), D(3).div(1.5).add(D(60).div(3)));
  });

  it('is zero with nothing automated', () => {
    expect(perSecond(createInitialState(0)).eq(ZERO)).toBe(true);
  });

  it('matches what advance actually pays over a long stretch', () => {
    const state = stateWith({}, { friet: { owned: 10, managed: true } });
    const seconds = 1500; // a whole number of 1.5s cycles
    expectClose(advance(state, seconds).earned, perSecond(state).mul(seconds));
  });
});

describe('buying', () => {
  it('spends exactly the geometric-sum cost and adds the units', () => {
    const state = stateWith({ cash: D(1000) }, { friet: { owned: 0 } });
    const cost = buyCost(FRIET, 0, 10);
    const after = buy(state, 'friet', 10);
    expect(getBusiness(after, 'friet').owned).toBe(10);
    expectClose(after.cash, D(1000).sub(cost));
  });

  it('refuses a purchase the player cannot afford', () => {
    const state = stateWith({ cash: D(5) }, { friet: { owned: 0 } });
    const after = buy(state, 'friet', 10);
    expect(after).toBe(state);
  });

  it('MAX buys as much as possible without going negative', () => {
    const state = stateWith({ cash: D(12_345) }, { friet: { owned: 3 } });
    const expected = maxBuy(FRIET, 3, state.cash);
    const after = buy(state, 'friet', 'MAX');
    expect(getBusiness(after, 'friet').owned).toBe(3 + expected);
    expect(after.cash.gte(ZERO)).toBe(true);
    expect(after.cash.lt(costOfNext(FRIET, 3 + expected))).toBe(true);
  });

  it('MAX with no affordable unit is a no-op', () => {
    const state = stateWith({ cash: D(1) }, { friet: { owned: 0 } });
    expect(buy(state, 'friet', 'MAX')).toBe(state);
  });

  it('uses the buy-amount toggle when no amount is given', () => {
    const state = setBuyAmount(stateWith({ cash: D(1e6) }), 100);
    expect(resolveBuyCount(state, 'friet')).toBe(100);
    expect(getBusiness(buy(state, 'friet'), 'friet').owned).toBe(1 + 100);
  });

  it('reports affordability and cost for the current toggle', () => {
    const state = stateWith({ cash: D(10) }, { friet: { owned: 0 } });
    expect(canAfford(state, 'friet', 1)).toBe(true);
    expect(canAfford(state, 'friet', 10)).toBe(false);
    expectClose(costForAmount(state, 'friet', 1), FRIET.baseCost);
  });

  it('does not mutate the input state', () => {
    const state = stateWith({ cash: D(1000) }, { friet: { owned: 0 } });
    buy(state, 'friet', 10);
    expectClose(state.cash, 1000);
    expect(getBusiness(state, 'friet').owned).toBe(0);
  });
});

describe('managers', () => {
  it('charges the manager cost and automates the business', () => {
    const state = stateWith({ cash: FRIET.managerCost }, { friet: { owned: 1 } });
    const after = hireManager(state, 'friet');
    expect(getBusiness(after, 'friet').managed).toBe(true);
    expect(after.cash.eq(ZERO)).toBe(true);
    expectClose(advance(after, FRIET.cycleTime).earned, 3);
  });

  it('refuses when unaffordable and is a no-op when already hired', () => {
    const poor = stateWith({ cash: D(10) });
    expect(hireManager(poor, 'friet')).toBe(poor);

    const rich = stateWith({ cash: FRIET.managerCost.mul(2) }, { friet: { owned: 1 } });
    const once = hireManager(rich, 'friet');
    expect(hireManager(once, 'friet')).toBe(once);
  });
});

describe('tapping', () => {
  it('starts a cycle on an owned, un-automated business', () => {
    const after = tap(stateWith({}, { friet: { owned: 1 } }), 'friet');
    expect(getBusiness(after, 'friet').active).toBe(true);
    expect(after.totalTaps).toBe(1);
  });

  it('is a no-op while a cycle is already running, when automated, or when unowned', () => {
    const running = tap(stateWith({}, { friet: { owned: 1 } }), 'friet');
    expect(tap(running, 'friet')).toBe(running);

    const managed = stateWith({}, { friet: { owned: 1, managed: true } });
    expect(tap(managed, 'friet')).toBe(managed);

    const unowned = stateWith({}, { friet: { owned: 0 } });
    expect(tap(unowned, 'friet')).toBe(unowned);
  });
});

describe('prestige', () => {
  it('uses floor(150 · sqrt(lifetime / 1e9))', () => {
    expect(investorsForLifetime(ZERO)).toBe(0);
    expect(investorsForLifetime(D(44_444))).toBe(0);
    expect(investorsForLifetime(D(44_445))).toBe(1);
    expect(investorsForLifetime(D(1e9))).toBe(150);
    expect(investorsForLifetime(D(4e9))).toBe(300);
    expect(investorsForLifetime(D('1e15'))).toBe(150_000);
  });

  it('offers the first investor at roughly €44.4k lifetime', () => {
    expect(canPrestige(stateWith({ lifetimeEarnings: D(44_000) }))).toBe(false);
    expect(canPrestige(stateWith({ lifetimeEarnings: D(45_000) }))).toBe(true);
  });

  it('resets cash and businesses but keeps investors and lifetime earnings', () => {
    let state = stateWith(
      { cash: D(5e6), lifetimeEarnings: D(1e9) },
      { friet: { owned: 120, managed: true }, wafel: { owned: 30, managed: true } },
    );
    expect(prestigeGain(state)).toBe(150);

    state = prestige(state);
    expect(state.investors).toBe(150);
    expect(state.cash.eq(ZERO)).toBe(true);
    expectClose(state.lifetimeEarnings, 1e9);
    expect(state.prestigeCount).toBe(1);
    expect(getBusiness(state, 'friet').owned).toBe(1);
    expect(getBusiness(state, 'friet').managed).toBe(false);
    expect(getBusiness(state, 'wafel').owned).toBe(0);
  });

  it('makes the permanent bonus survive the reset', () => {
    const after = prestige(stateWith({ lifetimeEarnings: D(1e9) }));
    expect(globalMultiplier(after)).toBeCloseTo(1 + 150 * INVESTOR_BONUS, 12);
  });

  it('does not pay the same lifetime earnings twice', () => {
    const after = prestige(stateWith({ lifetimeEarnings: D(1e9) }));
    expect(prestigeGain(after)).toBe(0);
    expect(prestige(after)).toBe(after);
  });

  it('pays only the difference on a later prestige', () => {
    let state = prestige(stateWith({ lifetimeEarnings: D(1e9) })); // 150 investors
    state = collect(state, D(3e9)); // lifetime 4e9 -> worth 300 total
    expect(prestigeGain(state)).toBe(150);
    expect(prestige(state).investors).toBe(300);
  });

  it('is a no-op below one investor', () => {
    const state = stateWith({ cash: D(100), lifetimeEarnings: D(100) });
    expect(prestige(state)).toBe(state);
  });
});

describe('offline earnings', () => {
  const managed = () => stateWith({}, { friet: { owned: 10, managed: true } });

  it('equals perSecond × elapsed', () => {
    const state = managed();
    const result = offlineEarnings(state, 3600);
    expect(result.seconds).toBe(3600);
    expect(result.capped).toBe(false);
    expectClose(result.amount, perSecond(state).mul(3600));
  });

  it('caps at 12 hours', () => {
    const state = managed();
    const result = offlineEarnings(state, 48 * 3600);
    expect(result.seconds).toBe(OFFLINE_CAP_SECONDS);
    expect(result.rawSeconds).toBe(48 * 3600);
    expect(result.capped).toBe(true);
    expectClose(result.amount, perSecond(state).mul(OFFLINE_CAP_SECONDS));
  });

  it('pays nothing with no automated income', () => {
    const idle = stateWith({}, { friet: { owned: 10 } });
    expect(offlineEarnings(idle, 3600).amount.eq(ZERO)).toBe(true);
  });

  it('handles zero and negative elapsed time', () => {
    for (const elapsed of [0, -100, Number.NaN]) {
      const r = offlineEarnings(managed(), elapsed);
      expect(r.seconds).toBe(0);
      expect(r.amount.eq(ZERO)).toBe(true);
    }
  });

  it('derives elapsed time from lastActiveAt', () => {
    const state = { ...managed(), lastActiveAt: 1_000_000 };
    const result = offlineEarningsSince(state, 1_000_000 + 3600 * 1000);
    expectClose(result.amount, perSecond(state).mul(3600));
  });

  it('banks the amount, doubles it for the rewarded ad, and re-anchors the clock', () => {
    const state = { ...managed(), lastActiveAt: 0 };
    const result = offlineEarnings(state, 3600);

    const plain = applyOffline(state, result, 1, 5_000);
    expectClose(plain.cash, result.amount);
    expectClose(plain.lifetimeEarnings, result.amount);
    expect(plain.lastActiveAt).toBe(5_000);

    const doubled = applyOffline(state, result, 2, 5_000);
    expectClose(doubled.cash, result.amount.mul(2));
  });

  it('matches what advance would have paid over the same window', () => {
    const state = managed();
    const seconds = 3600;
    expectClose(advance(state, seconds).earned, offlineEarnings(state, seconds).amount, 1e-6);
  });
});

describe('progression sanity', () => {
  it('lets a fresh save tap its way to the second business', () => {
    let state = createInitialState(0);
    expect(getBusiness(state, 'friet').owned).toBe(1);
    expect(state.cash.eq(ZERO)).toBe(true);

    // Tap the Frietkot until the Wafelkraam is affordable.
    let taps = 0;
    while (state.cash.lt(getDef('wafel').baseCost) && taps < 500) {
      state = tap(state, 'friet');
      state = advance(state, FRIET.cycleTime).state;
      taps += 1;
    }
    expect(taps).toBeLessThan(500);
    expect(canAfford(state, 'wafel', 1)).toBe(true);
  });

  it('has strictly increasing cost, revenue and cycle time across tiers', () => {
    for (let i = 1; i < BUSINESSES.length; i += 1) {
      expect(BUSINESSES[i].baseCost.gt(BUSINESSES[i - 1].baseCost)).toBe(true);
      expect(BUSINESSES[i].baseRevenue.gt(BUSINESSES[i - 1].baseRevenue)).toBe(true);
      expect(BUSINESSES[i].cycleTime).toBeGreaterThan(BUSINESSES[i - 1].cycleTime);
      expect(BUSINESSES[i].managerCost.gt(BUSINESSES[i - 1].managerCost)).toBe(true);
    }
  });

  it('keeps every later tier more profitable per second at equal unit counts', () => {
    const state = stateWith({}, {});
    const rates = BUSINESSES.map((def) => def.baseRevenue.mul(10).div(def.cycleTime));
    for (let i = 1; i < rates.length; i += 1) {
      expect(rates[i].gt(rates[i - 1])).toBe(true);
    }
    expect(state.businesses).toHaveLength(BUSINESSES.length);
  });
});

describe('architecture rule', () => {
  it('never imports React, React Native or a service from src/core', () => {
    const coreDir = path.join(__dirname, '..');
    const files = fs
      .readdirSync(coreDir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => path.join(coreDir, f));

    expect(files.length).toBeGreaterThan(0);
    const forbidden = /from\s+['"](react|react-native|@react-native|expo|.*\/(services|store|ui)\/)/;
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      expect({ file: path.basename(file), matches: forbidden.test(source) }).toEqual({
        file: path.basename(file),
        matches: false,
      });
    }
  });
});
