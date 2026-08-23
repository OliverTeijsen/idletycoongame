import { BAL } from '../balance';
import { D, ZERO } from '../numbers';
import { defaultState } from '../state';
import {
  autobuyerAvailable,
  autobuyerEnabled,
  tickAutomation,
  toggleAutobuyer,
} from '../systems/automation';
import { autobuyInterval } from '../systems/shardperks';
import { buyStarNode } from '../systems/starchart';

function collapsed() {
  const s = defaultState(0);
  s.collapses = 1;
  return s;
}

describe('gating', () => {
  it('nothing is available before the first collapse', () => {
    const s = defaultState(0);
    s.spark = D(1e6);
    expect(autobuyerAvailable(s, 'dim1')).toBe(false);
    tickAutomation(s, 10);
    expect(s.dims[0].bought).toBe(0);
  });

  it('tiers 1–3 + upgrade autobuyers open at P1; tier 4 needs the star node', () => {
    const s = collapsed();
    expect(autobuyerAvailable(s, 'dim1')).toBe(true);
    expect(autobuyerAvailable(s, 'dim3')).toBe(true);
    expect(autobuyerAvailable(s, 'sparkUpgrades')).toBe(true);
    expect(autobuyerAvailable(s, 'dim4')).toBe(false);

    s.shards = D(100);
    for (const id of ['ignite', 'handspark', 'servo4']) buyStarNode(s, id);
    expect(autobuyerAvailable(s, 'dim4')).toBe(true);
  });
});

describe('buying', () => {
  it('buys orbiters on the pass cadence, not every tick', () => {
    const s = collapsed();
    s.spark = D(1e4);
    tickAutomation(s, 0.05);
    expect(s.dims[0].bought).toBe(0); // interval not reached
    tickAutomation(s, autobuyInterval(s));
    expect(s.dims[0].bought).toBeGreaterThan(0);
  });

  it('higher tiers buy before tier 1', () => {
    const s = collapsed();
    // enough for one tier-3 orbiter and nothing else after
    s.spark = BAL.dimensions[2].baseCost;
    tickAutomation(s, 1);
    expect(s.dims[2].bought).toBe(1);
  });

  it('buys spark and mote upgrades', () => {
    const s = collapsed();
    // orbiter autobuyers off so they don't drain the spark first
    for (const id of ['dim1', 'dim2', 'dim3'] as const) toggleAutobuyer(s, id);
    s.spark = D(500); // covers Charge Coil (50) and Flux Lattice (200)
    s.motes = D(10); // covers Focus (10)
    tickAutomation(s, 1);
    expect(s.sparkUpgrades.chargeCoil ?? 0).toBeGreaterThan(0);
    expect(s.moteUpgrades.focus ?? 0).toBeGreaterThan(0);
  });

  it('toggles stop a specific autobuyer', () => {
    const s = collapsed();
    expect(autobuyerEnabled(s, 'dim1')).toBe(true); // default ON
    toggleAutobuyer(s, 'dim1');
    expect(autobuyerEnabled(s, 'dim1')).toBe(false);
    s.spark = D(1e4);
    toggleAutobuyer(s, 'dim2');
    toggleAutobuyer(s, 'dim3');
    toggleAutobuyer(s, 'sparkUpgrades');
    toggleAutobuyer(s, 'moteUpgrades');
    tickAutomation(s, 1);
    expect(s.dims[0].bought).toBe(0);
    expect(s.spark.eq(D(1e4))).toBe(true); // nothing spent at all
  });

  it('swift servos halves the interval per level', () => {
    const s = collapsed();
    const base = autobuyInterval(s);
    s.shardUpgrades = { swiftServos: 2 };
    expect(autobuyInterval(s)).toBeCloseTo(base / 4, 9);
  });

  it('a huge offline dt runs one pass, not hundreds', () => {
    const s = collapsed();
    s.spark = D(100);
    tickAutomation(s, 3600);
    // one pass happened (spark got spent), timer did not bank hours
    expect(s.autobuyTimer).toBeLessThan(autobuyInterval(s));
  });
});
