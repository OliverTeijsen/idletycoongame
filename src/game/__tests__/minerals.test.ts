import { BAL } from '../balance';
import { D, ZERO } from '../numbers';
import { offlineCapSeconds } from '../offline';
import { defaultState } from '../state';
import { allocateElement } from '../systems/elements';
import { managerSlots } from '../systems/managers';
import {
  buyMiner,
  buyResearch,
  minerCost,
  mineralsUnlocked,
  oreRate,
  tickMinerals,
} from '../systems/minerals';
import { autobuyInterval } from '../systems/shardperks';

function p3() {
  const s = defaultState(0);
  s.converges = 1;
  return s;
}

describe('miners', () => {
  it('locked before Converge', () => {
    const s = defaultState(0);
    s.spark = D('1e30');
    expect(mineralsUnlocked(s)).toBe(false);
    expect(buyMiner(s, 'drill')).toBe(false);
    expect(oreRate(s).eq(ZERO)).toBe(true);
  });

  it('buying costs spark, cost grows geometrically', () => {
    const s = p3();
    const def = BAL.miners[0];
    s.spark = def.baseCost;
    expect(buyMiner(s, 'drill')).toBe(true);
    expect(s.spark.eq(ZERO)).toBe(true);
    expect(s.miners.drill).toBe(1);
    expect(minerCost(s, 'drill').eq(def.baseCost.mul(def.costGrowth))).toBe(true);
  });

  it('ore accrues from owned miners', () => {
    const s = p3();
    s.miners = { drill: 10 };
    tickMinerals(s, 10);
    const expected = BAL.miners[0].orePerSec.mul(10).mul(10);
    expect(s.ore.sub(expected).abs().lt(D(1e-9))).toBe(true);
  });

  it('terra element boosts ore, allocatable only at P3', () => {
    const s = p3();
    s.ascends = 1;
    s.elements = { points: 2, alloc: {}, progress: 0 };
    expect(allocateElement(s, 'terra')).toBe(true);
    s.miners = { drill: 1 };
    const base = BAL.miners[0].orePerSec;
    expect(oreRate(s).div(base).sub(BAL.elements.perPoint.terra).abs().lt(D(1e-9))).toBe(true);
  });
});

describe('research', () => {
  it('one-time purchases with ore', () => {
    const s = p3();
    s.ore = D(50);
    expect(buyResearch(s, 'oreSluice')).toBe(true);
    expect(s.ore.eq(ZERO)).toBe(true);
    expect(buyResearch(s, 'oreSluice')).toBe(false); // owned
    s.ore = D(1e6);
    expect(buyResearch(s, 'nonsense')).toBe(false);
  });

  it('ore multipliers stack (sluice ×2, veins ×3)', () => {
    const s = p3();
    s.miners = { drill: 1 };
    const base = oreRate(s);
    s.research = { oreSluice: true, oreVein: true };
    expect(oreRate(s).div(base).sub(D(6)).abs().lt(D(1e-9))).toBe(true);
  });

  it('overclock halves the autobuy interval; deep clock adds 4h cap', () => {
    const s = p3();
    const interval = autobuyInterval(s);
    const cap = offlineCapSeconds(s);
    s.research = { fastServos: true, deepClock: true };
    expect(autobuyInterval(s)).toBeCloseTo(interval / 2, 9);
    expect(offlineCapSeconds(s) - cap).toBe(4 * 3600);
  });

  it('quarters add manager slots', () => {
    const s = p3();
    expect(managerSlots(s)).toBe(BAL.managers.baseSlots);
    s.research = { slotA: true, slotB: true };
    expect(managerSlots(s)).toBe(BAL.managers.baseSlots + 2);
  });
});
