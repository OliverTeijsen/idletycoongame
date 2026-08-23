import { BAL } from '../balance';
import { D, ONE, ZERO } from '../numbers';
import { defaultState } from '../state';
import { tickDimensions } from '../systems/dimensions';
import { sparkMult, tierMult } from '../systems/multipliers';
import { buySparkUpgrade, tapPower, upgradeCost, upgradeMult } from '../systems/upgrades';

describe('tap power', () => {
  it('base tap matches balance', () => {
    const s = defaultState(0);
    expect(tapPower(s).eq(BAL.tapBase)).toBe(true);
  });

  it('charge coil doubles per level', () => {
    const s = defaultState(0);
    s.sparkUpgrades = { chargeCoil: 3 };
    expect(tapPower(s).eq(BAL.tapBase.mul(8))).toBe(true);
  });
});

describe('spark upgrades', () => {
  it('purchase deducts spark, level rises, cost rises', () => {
    const s = defaultState(0);
    const def = BAL.sparkUpgrades.find((u) => u.id === 'fluxLattice')!;
    s.spark = def.baseCost;
    expect(buySparkUpgrade(s, 'fluxLattice')).toBe(true);
    expect(s.spark.eq(ZERO)).toBe(true);
    expect(s.sparkUpgrades.fluxLattice).toBe(1);
    expect(upgradeCost(def, 1).gt(def.baseCost)).toBe(true);
  });

  it('cannot exceed maxLevel', () => {
    const s = defaultState(0);
    const def = BAL.sparkUpgrades.find((u) => u.id === 'ignition')!;
    s.sparkUpgrades = { ignition: def.maxLevel! };
    s.spark = D('1e100');
    expect(buySparkUpgrade(s, 'ignition')).toBe(false);
  });

  it('flux lattice raises the spark multiplier', () => {
    const s = defaultState(0);
    expect(sparkMult(s).eq(ONE)).toBe(true);
    s.sparkUpgrades = { fluxLattice: 2 };
    const def = BAL.sparkUpgrades.find((u) => u.id === 'fluxLattice')!;
    expect(sparkMult(s).sub(def.effectPerLevel.pow(2)).abs().lt(D(1e-9))).toBe(true);
  });

  it('ignition boosts only tier 1; cascade only tiers 2+', () => {
    const s = defaultState(0);
    s.sparkUpgrades = { ignition: 1, cascade: 1 };
    const t1 = tierMult(s, 1);
    const t2 = tierMult(s, 2);
    expect(t1.eq(D(2))).toBe(true);
    expect(t2.eq(D(1.1))).toBe(true);
  });

  it('upgrade effects show up in actual production', () => {
    const plain = defaultState(0);
    plain.dims[0].amount = D(10);
    const upgraded = defaultState(0);
    upgraded.dims[0].amount = D(10);
    upgraded.sparkUpgrades = { fluxLattice: 1, ignition: 1 };
    tickDimensions(plain, 1);
    tickDimensions(upgraded, 1);
    // ×1.25 (lattice) ×2 (ignition) = ×2.5
    expect(upgraded.spark.div(plain.spark).sub(D(2.5)).abs().lt(D(1e-9))).toBe(true);
  });

  it('upgradeMult of level 0 is 1', () => {
    const def = BAL.sparkUpgrades[0];
    expect(upgradeMult(def, 0).eq(ONE)).toBe(true);
  });
});
