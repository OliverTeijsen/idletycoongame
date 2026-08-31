import { BAL } from '../balance';
import { D, ZERO } from '../numbers';
import { defaultState } from '../state';
import {
  TIER_COUNT,
  buyDim,
  canDimBoost,
  dimCost,
  dimBoostRequirement,
  dimCostFor,
  dimMaxAffordable,
  doDimBoost,
  freshDims,
  highestUnlockedTier,
  sparkRate,
  tickDimensions,
} from '../systems/dimensions';

describe('costs', () => {
  it('first cost matches balance, grows geometrically', () => {
    const s = defaultState(0);
    expect(dimCost(s, 1).eq(BAL.dimensions[0].baseCost)).toBe(true);
    s.dims[0].bought = 3;
    const expected = BAL.dimensions[0].baseCost.mul(BAL.dimensions[0].costGrowth.pow(3));
    expect(dimCost(s, 1).eq(expected)).toBe(true);
  });

  it('dimCostFor sums the geometric series', () => {
    const s = defaultState(0);
    const g = BAL.dimensions[0].costGrowth;
    const c = BAL.dimensions[0].baseCost;
    const manual = c.add(c.mul(g)).add(c.mul(g.pow(2)));
    expect(dimCostFor(s, 1, 3).sub(manual).abs().lt(D(1e-6))).toBe(true);
  });

  it('dimMaxAffordable is exact at boundaries', () => {
    const s = defaultState(0);
    s.spark = dimCostFor(s, 1, 5); // exactly 5 purchases worth
    expect(dimMaxAffordable(s, 1)).toBe(5);
    s.spark = s.spark.sub(D(0.01));
    expect(dimMaxAffordable(s, 1)).toBe(4);
    s.spark = ZERO;
    expect(dimMaxAffordable(s, 1)).toBe(0);
  });

  it('dimMaxAffordable handles absurd wealth without hanging', () => {
    const s = defaultState(0);
    s.spark = D('1e500');
    const n = dimMaxAffordable(s, 1);
    expect(n).toBeGreaterThan(1000);
    expect(dimCostFor(s, 1, n).lte(s.spark)).toBe(true);
  });
});

describe('buying', () => {
  it('buy 1 deducts spark and increments both counters', () => {
    const s = defaultState(0);
    s.spark = D(10);
    expect(buyDim(s, 1, 1)).toBe(1);
    expect(s.spark.eq(ZERO)).toBe(true);
    expect(s.dims[0].bought).toBe(1);
    expect(s.dims[0].amount.toNumber()).toBe(1);
  });

  it('buy 10 buys what it can afford', () => {
    const s = defaultState(0);
    s.spark = dimCostFor(s, 1, 3);
    expect(buyDim(s, 1, 10)).toBe(3);
  });

  it('cannot buy a locked tier', () => {
    const s = defaultState(0);
    s.spark = D('1e50');
    expect(s.dims[7].unlocked).toBe(false);
    expect(buyDim(s, 8, 1)).toBe(0);
  });

  it('MAX buys everything affordable', () => {
    const s = defaultState(0);
    s.spark = dimCostFor(s, 1, 7);
    expect(buyDim(s, 1, 'MAX')).toBe(7);
    expect(dimMaxAffordable(s, 1)).toBe(0);
  });
});

describe('production cascade', () => {
  it('tier 1 produces spark', () => {
    const s = defaultState(0);
    s.dims[0].amount = D(10);
    tickDimensions(s, 1);
    const expected = D(10).mul(BAL.dimensions[0].perOrbiter);
    expect(s.spark.sub(expected).abs().lt(D(1e-9))).toBe(true);
    expect(s.totalSpark.eq(s.spark)).toBe(true);
    expect(s.bestSparkRun.eq(s.spark)).toBe(true);
  });

  it('tier 2 produces tier 1 within the same tick (top-down, per §6.2 pseudocode)', () => {
    const s = defaultState(0);
    s.dims[1].amount = D(100);
    tickDimensions(s, 1);
    expect(s.dims[0].amount.gt(ZERO)).toBe(true);
    // the spec cascade is top-down: this tick's fresh tier-1 orbiters already
    // produce a sliver of spark in the same tick
    expect(s.spark.gt(ZERO)).toBe(true);
    const after1 = s.spark;
    tickDimensions(s, 1);
    expect(s.spark.gt(after1)).toBe(true);
  });

  it('sparkRate matches one second of actual production', () => {
    const s = defaultState(0);
    s.dims[0].amount = D(25);
    const rate = sparkRate(s);
    tickDimensions(s, 1);
    expect(s.spark.sub(rate).abs().div(rate).lt(D(1e-9))).toBe(true);
  });

  it('a poisoned multiplier cannot write NaN into spark', () => {
    const s = defaultState(0);
    s.dims[0].amount = D(NaN);
    tickDimensions(s, 1);
    expect(Number.isNaN(s.spark.mantissa)).toBe(false);
  });
});

describe('dimension boost', () => {
  it('starting tiers match balance, later tiers locked', () => {
    const dims = freshDims();
    expect(dims).toHaveLength(TIER_COUNT);
    dims.forEach((d, i) => expect(d.unlocked).toBe(i < BAL.startingTiers));
  });

  it('requires the threshold on the highest unlocked tier', () => {
    const s = defaultState(0);
    expect(canDimBoost(s)).toBe(false);
    s.dims[BAL.startingTiers - 1].bought = BAL.dimBoost.requirement;
    expect(canDimBoost(s)).toBe(true);
  });

  it('boost resets spark and purchases, unlocks the next tier, keeps upgrades', () => {
    const s = defaultState(0);
    s.spark = D(5000);
    s.sparkUpgrades = { fluxLattice: 3 };
    s.motes = D(42);
    s.dims[BAL.startingTiers - 1].bought = BAL.dimBoost.requirement;
    s.dims[0].amount = D(999);

    expect(doDimBoost(s)).toBe(true);
    expect(s.dimBoosts).toBe(1);
    // spark resets to the restart grant (enough for one Tier-1 orbiter)
    expect(s.spark.eq(BAL.dimBoost.startingSpark)).toBe(true);
    expect(s.dims[0].amount.eq(ZERO)).toBe(true);
    expect(s.dims[0].bought).toBe(0);
    expect(highestUnlockedTier(s)).toBe(BAL.startingTiers + 1);
    expect(s.sparkUpgrades.fluxLattice).toBe(3); // kept
    expect(s.motes.toNumber()).toBe(42); // kept
  });

  it('boosted production is ×mult per boost', () => {
    const boosted = defaultState(0);
    boosted.dimBoosts = 2;
    boosted.dims[0].amount = D(10);
    const plain = defaultState(0);
    plain.dims[0].amount = D(10);
    tickDimensions(boosted, 1);
    tickDimensions(plain, 1);
    const ratio = boosted.spark.div(plain.spark);
    expect(ratio.sub(BAL.dimBoost.mult.pow(2)).abs().lt(D(1e-9))).toBe(true);
  });

  it('tier count cannot exceed TIER_COUNT no matter how many boosts', () => {
    const s = defaultState(0);
    for (let i = 0; i < 20; i++) {
      const highest = highestUnlockedTier(s);
      s.dims[highest - 1].bought = dimBoostRequirement(s);
      doDimBoost(s);
    }
    expect(highestUnlockedTier(s)).toBe(TIER_COUNT);
  });
});
