import { BAL } from '../balance';
import { D, ZERO } from '../numbers';
import { defaultState } from '../state';
import {
  buyMoteUpgrade,
  moteRate,
  motesUnlocked,
  resonanceMult,
  tickMotes,
} from '../systems/motes';
import { upgradeCost } from '../systems/upgrades';

describe('mote accrual', () => {
  it('no tier-1 orbiters → no motes, tab locked', () => {
    const s = defaultState(0);
    expect(moteRate(s).eq(ZERO)).toBe(true);
    tickMotes(s, 100);
    expect(s.motes.eq(ZERO)).toBe(true);
    expect(motesUnlocked(s)).toBe(false);
  });

  it('rate scales with sqrt of tier-1 amount', () => {
    const s = defaultState(0);
    s.dims[0].amount = D(100);
    const expected = BAL.motes.base.mul(D(10));
    expect(moteRate(s).sub(expected).abs().lt(D(1e-9))).toBe(true);
  });

  it('accrual unlocks the tab and tracks motesEver', () => {
    const s = defaultState(0);
    s.dims[0].amount = D(4);
    tickMotes(s, 10);
    expect(s.motes.gt(ZERO)).toBe(true);
    expect(s.motesEver.eq(s.motes)).toBe(true);
    expect(motesUnlocked(s)).toBe(true);
  });
});

describe('mote upgrades', () => {
  it('buying deducts motes and raises the level', () => {
    const s = defaultState(0);
    const def = BAL.motes.upgrades.find((u) => u.id === 'focus')!;
    s.motes = def.baseCost;
    expect(buyMoteUpgrade(s, 'focus')).toBe(true);
    expect(s.motes.eq(ZERO)).toBe(true);
    expect(s.moteUpgrades.focus).toBe(1);
    expect(buyMoteUpgrade(s, 'focus')).toBe(false); // can no longer afford
  });

  it('costs grow geometrically', () => {
    const def = BAL.motes.upgrades.find((u) => u.id === 'resonance')!;
    expect(upgradeCost(def, 0).eq(def.baseCost)).toBe(true);
    expect(upgradeCost(def, 2).eq(def.baseCost.mul(def.costGrowth.pow(2)))).toBe(true);
  });

  it('resonance boosts the rate and is softcapped', () => {
    const s = defaultState(0);
    s.dims[0].amount = D(100);
    const base = moteRate(s);
    s.moteUpgrades = { resonance: 2 };
    const boosted = moteRate(s);
    const def = BAL.motes.upgrades.find((u) => u.id === 'resonance')!;
    expect(boosted.div(base).sub(def.effectPerLevel.pow(2)).abs().lt(D(1e-9))).toBe(true);

    // absurd level: multiplier grows sublinearly past the softcap threshold
    s.moteUpgrades = { resonance: 200 };
    const capped = resonanceMult(s);
    const uncapped = def.effectPerLevel.pow(200);
    expect(capped.lt(uncapped)).toBe(true);
    expect(capped.gte(BAL.softcap.resonance.t)).toBe(true);
  });

  it('unknown upgrade id is a no-op', () => {
    const s = defaultState(0);
    s.motes = D(1e9);
    expect(buyMoteUpgrade(s, 'nonsense')).toBe(false);
  });
});
