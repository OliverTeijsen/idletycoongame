/**
 * Cash upgrades: the per-tier endless track, and the run's cash sink.
 *
 * The pairing that matters here is with prestige. Perks survive a sale and
 * upgrades do not, and those two facts are what keep a run and the meta from
 * collapsing into the same thing.
 */
import {
  UPGRADE_COST_FACTOR,
  UPGRADE_COST_GROWTH,
  UPGRADE_STEP,
  getDef,
} from '../businesses';
import {
  businessPerSecond,
  canBuyUpgrade,
  cycleRevenue,
  perSecond,
  totalUpgradeLevels,
  upgradeCost,
  upgradeCostFor,
  upgradeLevel,
  upgradeMult,
} from '../economy';
import { D, Decimal, ZERO } from '../numbers';
import {
  advance,
  buyUpgrade,
  createInitialState,
  freshUpgrades,
  prestige,
  tap,
} from '../engine';
import type { BusinessId, GameState } from '../types';

const FRIET = getDef('friet');

function owning(id: BusinessId, owned: number, extra: Partial<GameState> = {}): GameState {
  const base = createInitialState(0);
  return {
    ...base,
    cash: D('1e40'),
    ...extra,
    businesses: base.businesses.map((bs) =>
      bs.id === id ? { ...bs, owned, managed: true } : bs,
    ),
  };
}

function expectClose(actual: Decimal, expected: Decimal | number, rel = 1e-9): void {
  const e = D(expected);
  if (e.eq(ZERO)) {
    expect(actual.abs().lt(1e-6)).toBe(true);
    return;
  }
  expect(actual.sub(e).abs().div(e.abs()).toNumber()).toBeLessThan(rel);
}

describe('levels and price', () => {
  it('starts every tier at zero', () => {
    const fresh = createInitialState(0);
    expect(totalUpgradeLevels(fresh)).toBe(0);
    for (const id of Object.keys(freshUpgrades()) as BusinessId[]) {
      expect(upgradeLevel(fresh, id)).toBe(0);
      expect(upgradeMult(fresh, id).toNumber()).toBe(1);
    }
  });

  it('prices the first upgrade off the base unit cost of the tier', () => {
    expectClose(upgradeCostFor(FRIET, 0), FRIET.baseCost.mul(UPGRADE_COST_FACTOR));
  });

  it('multiplies the price by the growth factor each level', () => {
    for (const level of [1, 2, 5, 12]) {
      expectClose(
        upgradeCostFor(FRIET, level),
        FRIET.baseCost.mul(UPGRADE_COST_FACTOR).mul(Math.pow(UPGRADE_COST_GROWTH, level)),
      );
    }
  });

  it('scales the price with the tier, so late tiers are not trivially upgraded', () => {
    const empire = getDef('empire');
    expect(upgradeCostFor(empire, 0).gt(upgradeCostFor(FRIET, 0))).toBe(true);
  });

  it('never runs out of levels', () => {
    // Level 400 is a ×2^400 payoff at a price to match. The track has no top;
    // what stops the player is always the price.
    const cost = upgradeCostFor(FRIET, 400);
    expect(cost.gt(upgradeCostFor(FRIET, 399))).toBe(true);
    expect(Number.isFinite(cost.mantissa)).toBe(true);
  });

  it('stays exact past the range of a JS number', () => {
    // The reason upgradeMult returns a Decimal, same as milestoneMult.
    const state = { ...createInitialState(0), upgrades: { ...freshUpgrades(), friet: 1_100 } };
    const mult = upgradeMult(state, 'friet');
    expect(Number.isFinite(mult.mantissa)).toBe(true);
    expect(mult.log10()).toBeCloseTo(1_100 * Math.log10(2), 6);
  });
});

describe('buying', () => {
  it('spends the cash and doubles the tier', () => {
    const before = owning('friet', 10, { cash: D(1e6) });
    const cost = upgradeCost(before, 'friet');
    const revenueBefore = cycleRevenue(before, 'friet');

    const after = buyUpgrade(before, 'friet');
    expect(upgradeLevel(after, 'friet')).toBe(1);
    expectClose(after.cash, D(1e6).sub(cost));
    expectClose(cycleRevenue(after, 'friet'), revenueBefore.mul(UPGRADE_STEP));
  });

  it('compounds across levels', () => {
    let state = owning('friet', 10);
    const base = cycleRevenue(state, 'friet');
    for (let i = 0; i < 6; i += 1) state = buyUpgrade(state, 'friet');

    expect(upgradeLevel(state, 'friet')).toBe(6);
    expectClose(cycleRevenue(state, 'friet'), base.mul(Math.pow(UPGRADE_STEP, 6)));
  });

  it('leaves every other tier alone', () => {
    const state = buyUpgrade(owning('friet', 10), 'friet');
    expect(upgradeLevel(state, 'wafel')).toBe(0);
    expect(upgradeMult(state, 'wafel').toNumber()).toBe(1);
  });

  it('is a no-op when the cash is not there', () => {
    const broke = owning('friet', 10, { cash: ZERO });
    expect(canBuyUpgrade(broke, 'friet')).toBe(false);
    expect(buyUpgrade(broke, 'friet')).toBe(broke);
  });

  it('refuses to upgrade a tier the player does not own', () => {
    // Doubling nothing is not a purchase, it is a way to lose money.
    const rich = { ...createInitialState(0), cash: D('1e40') };
    expect(canBuyUpgrade(rich, 'empire')).toBe(false);
    expect(buyUpgrade(rich, 'empire')).toBe(rich);
  });

  it('does not mutate the state it was given', () => {
    const before = owning('friet', 10);
    buyUpgrade(before, 'friet');
    expect(upgradeLevel(before, 'friet')).toBe(0);
  });
});

describe('the multiplier reaches the money', () => {
  it('pays through a managed tick', () => {
    const plain = owning('friet', 10);
    const upgraded = buyUpgrade(buyUpgrade(plain, 'friet'), 'friet');

    const a = advance(plain, FRIET.cycleTime).earned;
    const b = advance(upgraded, FRIET.cycleTime).earned;
    expectClose(b, a.mul(4));
  });

  it('pays through a manual tap', () => {
    const plain = tap({ ...owning('friet', 10), businesses: owning('friet', 10).businesses.map((bs) => ({ ...bs, managed: false })) }, 'friet');
    const upgraded = tap(
      {
        ...buyUpgrade(owning('friet', 10), 'friet'),
        businesses: owning('friet', 10).businesses.map((bs) => ({ ...bs, managed: false })),
      },
      'friet',
    );

    const a = advance(plain, FRIET.cycleTime).earned;
    const b = advance(upgraded, FRIET.cycleTime).earned;
    expectClose(b, a.mul(UPGRADE_STEP));
  });

  it('shows up in the income rate, per tier and in total', () => {
    const plain = owning('friet', 10);
    const upgraded = buyUpgrade(plain, 'friet');

    expectClose(businessPerSecond(upgraded, 'friet'), businessPerSecond(plain, 'friet').mul(2));
    expectClose(perSecond(upgraded), perSecond(plain).mul(2));
  });
});

describe('prestige', () => {
  it('wipes the upgrades, because it wipes the cash that bought them', () => {
    let state = owning('friet', 10, { lifetimeEarnings: D(1e9) });
    state = buyUpgrade(buyUpgrade(state, 'friet'), 'friet');
    expect(totalUpgradeLevels(state)).toBe(2);

    const after = prestige(state);
    expect(totalUpgradeLevels(after)).toBe(0);
    expect(upgradeMult(after, 'friet').toNumber()).toBe(1);
  });

  it('keeps perks while dropping upgrades — the two tracks are not the same', () => {
    let state = owning('friet', 10, { lifetimeEarnings: D(1e9) });
    state = { ...buyUpgrade(state, 'friet'), perks: { ...state.perks, profit: 3 } };

    const after = prestige(state);
    expect(after.perks.profit).toBe(3);
    expect(totalUpgradeLevels(after)).toBe(0);
  });
});
