import { BAL } from '../balance';
import { D, ONE, ZERO } from '../numbers';
import { defaultState } from '../state';
import { sparkRate, tapGain, tickDimensions } from '../systems/dimensions';
import { sparkMult, tierMult } from '../systems/multipliers';
import { buySparkUpgrade, tapPower, upgradeCost, upgradeMult } from '../systems/upgrades';

describe('tap power', () => {
  it('base tap matches balance', () => {
    const s = defaultState(0);
    expect(tapPower(s).eq(BAL.tapBase)).toBe(true);
  });

  it('charge coil multiplies tap power per level', () => {
    const s = defaultState(0);
    const def = BAL.sparkUpgrades.find((u) => u.id === 'chargeCoil')!;
    s.sparkUpgrades = { chargeCoil: 3 };
    expect(tapPower(s).eq(BAL.tapBase.mul(def.effectPerLevel.pow(3)))).toBe(true);
  });

  /**
   * The other half of a tap: a slice of your CURRENT production, whichever is
   * larger. It is what keeps tapping alive after the flat power has been left
   * behind, and what gives the opening seconds of every reset something to do
   * (BAL.tapProductionSeconds).
   */
  it('a tap is worth a slice of production once that beats the flat power', () => {
    const s = defaultState(0);
    s.dims[0].amount = D(1e6);
    const rate = sparkRate(s);
    expect(rate.mul(BAL.tapProductionSeconds).gt(tapPower(s))).toBe(true);
    expect(tapGain(s).sub(rate.mul(BAL.tapProductionSeconds)).abs().div(rate).lt(D(1e-9))).toBe(
      true,
    );
  });

  it('a tap never pays less than its flat power', () => {
    const s = defaultState(0);
    // No orbiters: production is zero, so the flat power is what a tap gives.
    expect(tapGain(s).eq(tapPower(s))).toBe(true);
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
    const ignition = BAL.sparkUpgrades.find((u) => u.id === 'ignition')!;
    const cascade = BAL.sparkUpgrades.find((u) => u.id === 'cascade')!;
    s.sparkUpgrades = { ignition: 1, cascade: 1 };
    expect(tierMult(s, 1).eq(ignition.effectPerLevel)).toBe(true);
    expect(tierMult(s, 2).eq(cascade.effectPerLevel)).toBe(true);
  });

  /**
   * Chain Reaction is the only multiplier that grows with a tier's DEPTH, so
   * it is the only reason to push Dimension Boosts for anything beyond the
   * flat times-two. Tier 8 must get eight times the exponent Tier 1 does.
   */
  it('chain reaction compounds with tier depth', () => {
    const s = defaultState(0);
    const def = BAL.sparkUpgrades.find((u) => u.id === 'chainReaction')!;
    s.sparkUpgrades = { chainReaction: 2 };
    expect(tierMult(s, 1).sub(def.effectPerLevel.pow(2)).abs().lt(D(1e-9))).toBe(true);
    expect(tierMult(s, 8).sub(def.effectPerLevel.pow(16)).abs().lt(D(1e-6))).toBe(true);
  });

  it('upgrade effects show up in actual production', () => {
    const plain = defaultState(0);
    plain.dims[0].amount = D(10);
    const upgraded = defaultState(0);
    upgraded.dims[0].amount = D(10);
    upgraded.sparkUpgrades = { fluxLattice: 1, ignition: 1 };
    tickDimensions(plain, 1);
    tickDimensions(upgraded, 1);
    // Flux Lattice × Ignition, read from the defs so a retune cannot rot this.
    const lattice = BAL.sparkUpgrades.find((u) => u.id === 'fluxLattice')!;
    const ignition = BAL.sparkUpgrades.find((u) => u.id === 'ignition')!;
    const expected = lattice.effectPerLevel.mul(ignition.effectPerLevel);
    expect(upgraded.spark.div(plain.spark).sub(expected).abs().lt(D(1e-9))).toBe(true);
  });

  it('upgradeMult of level 0 is 1', () => {
    const def = BAL.sparkUpgrades[0];
    expect(upgradeMult(def, 0).eq(ONE)).toBe(true);
  });
});
