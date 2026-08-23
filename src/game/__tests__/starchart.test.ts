import { BAL } from '../balance';
import { D, ONE, ZERO } from '../numbers';
import { offlineCapSeconds } from '../offline';
import { defaultState } from '../state';
import { moteRate } from '../systems/motes';
import { globalMult, shardMult, speedMult, tierMult } from '../systems/multipliers';
import {
  buyStarNode,
  canBuyNode,
  respecStarChart,
  starAutobuyTier,
  starChartSpent,
  starGlobalMult,
} from '../systems/starchart';
import { tapPower } from '../systems/upgrades';

function rich() {
  const s = defaultState(0);
  s.shards = D(1000);
  s.collapses = 1;
  return s;
}

describe('buying nodes', () => {
  it('root node buys; cost is deducted', () => {
    const s = rich();
    expect(buyStarNode(s, 'ignite')).toBe(true);
    expect(s.starChart.ignite).toBe(true);
    expect(s.shards.eq(D(999))).toBe(true);
  });

  it('prerequisites gate purchases', () => {
    const s = rich();
    expect(canBuyNode(s, 'kindling')).toBe(false);
    buyStarNode(s, 'ignite');
    expect(canBuyNode(s, 'kindling')).toBe(true);
  });

  it('cannot buy twice, cannot buy unknown, cannot buy broke', () => {
    const s = rich();
    buyStarNode(s, 'ignite');
    expect(buyStarNode(s, 'ignite')).toBe(false);
    expect(buyStarNode(s, 'nonsense')).toBe(false);
    s.shards = ZERO;
    expect(buyStarNode(s, 'handspark')).toBe(false);
  });

  it('ring 2 is locked in Phase 3 even with prereqs met', () => {
    const s = rich();
    for (const id of ['ignite', 'kindling', 'lattice', 'corona']) buyStarNode(s, id);
    expect(canBuyNode(s, 'outerIgnite')).toBe(false);
  });
});

describe('node effects reach the stack', () => {
  it('global nodes multiply into the stack', () => {
    const s = rich();
    buyStarNode(s, 'ignite');
    expect(starGlobalMult(s).sub(D(1.1)).abs().lt(D(1e-9))).toBe(true);
    // globalMult is the composition of starGlobalMult and shardMult (§9)
    const expected = starGlobalMult(s).mul(shardMult(s));
    expect(globalMult(s).sub(expected).abs().div(expected).lt(D(1e-9))).toBe(true);
  });

  it('tier nodes multiply only their tier', () => {
    const s = rich();
    buyStarNode(s, 'ignite');
    const t1Before = tierMult(s, 1);
    const t2Before = tierMult(s, 2);
    buyStarNode(s, 'kindling');
    expect(tierMult(s, 1).div(t1Before).sub(D(1.5)).abs().lt(D(1e-9))).toBe(true);
    expect(tierMult(s, 2).eq(t2Before)).toBe(true);
  });

  it('mote, tap, speed, offline-cap and autobuy nodes work', () => {
    const s = rich();
    s.dims[0].amount = D(100);
    const moteBefore = moteRate(s);
    const tapBefore = tapPower(s);
    const speedBefore = speedMult(s);
    const capBefore = offlineCapSeconds(s);
    expect(starAutobuyTier(s, 4)).toBe(false);

    for (const id of ['ignite', 'moteStream', 'handspark', 'servo4', 'driftClock', 'gyreSpin'])
      expect(buyStarNode(s, id)).toBe(true);

    expect(moteRate(s).div(moteBefore).sub(D(2)).abs().lt(D(1e-9))).toBe(true);
    expect(tapPower(s).div(tapBefore).sub(D(4)).abs().lt(D(1e-9))).toBe(true);
    expect(speedMult(s).div(speedBefore).sub(D(1.25)).abs().lt(D(1e-9))).toBe(true);
    expect(offlineCapSeconds(s) - capBefore).toBe(2 * 3600);
    expect(starAutobuyTier(s, 4)).toBe(true);
  });
});

describe('respec', () => {
  it('refunds every spent shard and clears all nodes', () => {
    const s = rich();
    buyStarNode(s, 'ignite');
    buyStarNode(s, 'kindling');
    const spent = starChartSpent(s);
    expect(spent.eq(D(3))).toBe(true);
    const before = s.shards;
    respecStarChart(s);
    expect(s.shards.eq(before.add(spent))).toBe(true);
    expect(Object.keys(s.starChart)).toHaveLength(0);
    expect(starGlobalMult(s).eq(ONE)).toBe(true);
  });
});
