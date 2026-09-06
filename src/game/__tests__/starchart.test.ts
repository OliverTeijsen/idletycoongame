import { BAL } from '../balance';
import { D, ONE, ZERO } from '../numbers';
import { offlineCapSeconds } from '../offline';
import { defaultState } from '../state';
import { oreRate } from '../systems/minerals';
import { moteRate } from '../systems/motes';
import { globalMult, shardMult, speedMult, tierMult } from '../systems/multipliers';
import {
  buyStarNode,
  canBuyNode,
  nodeCost,
  nodeRank,
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

/** The definition, so these tests do not have to be retuned with the balance. */
const ignite = BAL.starChart.find((n) => n.id === 'ignite')!;

describe('buying nodes', () => {
  it('root node buys; cost is deducted', () => {
    const s = rich();
    expect(buyStarNode(s, 'ignite')).toBe(true);
    expect(nodeRank(s, 'ignite')).toBe(1);
    expect(s.shards.eq(D(1000).sub(ignite.baseCost))).toBe(true);
  });

  it('prerequisites gate purchases', () => {
    const s = rich();
    expect(canBuyNode(s, 'kindling')).toBe(false);
    buyStarNode(s, 'ignite');
    expect(canBuyNode(s, 'kindling')).toBe(true);
  });

  /**
   * The heart of the ranked chart: a node is a purchase you come back to, and
   * each rank costs more. Without this the whole tree is bought out during the
   * first Ascend and Shards stop meaning anything (see BAL.starChart).
   */
  it('nodes take repeated ranks at a rising price', () => {
    const s = rich();
    const first = nodeCost(s, 'ignite');
    expect(buyStarNode(s, 'ignite')).toBe(true);
    const second = nodeCost(s, 'ignite');
    expect(second.gt(first)).toBe(true);
    expect(buyStarNode(s, 'ignite')).toBe(true);
    expect(nodeRank(s, 'ignite')).toBe(2);
    // The effect compounds per rank.
    expect(starGlobalMult(s).sub(D(1.12).pow(2)).abs().lt(D(1e-9))).toBe(true);
  });

  it('a capped node stops at its maxRank', () => {
    const s = rich();
    s.shards = D('1e30');
    buyStarNode(s, 'ignite');
    buyStarNode(s, 'handspark');
    const servo = BAL.starChart.find((n) => n.id === 'servo4')!;
    expect(servo.maxRank).toBe(1);
    expect(buyStarNode(s, 'servo4')).toBe(true);
    expect(buyStarNode(s, 'servo4')).toBe(false);
  });

  it('cannot buy unknown, cannot buy broke', () => {
    const s = rich();
    buyStarNode(s, 'ignite');
    expect(buyStarNode(s, 'nonsense')).toBe(false);
    s.shards = ZERO;
    expect(buyStarNode(s, 'handspark')).toBe(false);
  });

  it('rings 2 and 3 are locked until Ascend and Converge', () => {
    const s = rich();
    s.shards = D('1e12');
    for (const id of ['ignite', 'kindling', 'lattice', 'corona']) buyStarNode(s, id);
    expect(canBuyNode(s, 'outerIgnite')).toBe(false);
    s.ascends = 1;
    expect(canBuyNode(s, 'outerIgnite')).toBe(true);
    expect(canBuyNode(s, 'deepCore')).toBe(false);
    buyStarNode(s, 'outerIgnite');
    s.converges = 1;
    expect(canBuyNode(s, 'deepCore')).toBe(true);
  });
});

describe('node effects reach the stack', () => {
  it('global nodes multiply into the stack', () => {
    const s = rich();
    buyStarNode(s, 'ignite');
    expect(starGlobalMult(s).sub(D(1.12)).abs().lt(D(1e-9))).toBe(true);
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
    expect(tapPower(s).div(tapBefore).sub(D(5)).abs().lt(D(1e-9))).toBe(true);
    expect(speedMult(s).div(speedBefore).sub(D(1.18)).abs().lt(D(1e-9))).toBe(true);
    expect(offlineCapSeconds(s) - capBefore).toBe(2 * 3600);
    expect(starAutobuyTier(s, 4)).toBe(true);
  });

  it('the Ore node reaches the mining lane — the cross-layer link', () => {
    const s = rich();
    s.shards = D('1e12');
    s.ascends = 1;
    s.converges = 1;
    s.miners = { drill: 10 };
    for (const id of ['ignite', 'kindling', 'lattice', 'corona', 'outerIgnite'])
      expect(buyStarNode(s, id)).toBe(true);
    const before = oreRate(s);
    expect(buyStarNode(s, 'deepVein')).toBe(true);
    expect(oreRate(s).div(before).sub(D(2)).abs().lt(D(1e-9))).toBe(true);
  });
});

describe('respec', () => {
  it('refunds every spent shard across every rank and clears the chart', () => {
    const s = rich();
    buyStarNode(s, 'ignite');
    buyStarNode(s, 'ignite');
    buyStarNode(s, 'kindling');
    const spent = starChartSpent(s);
    const before = s.shards;
    respecStarChart(s);
    expect(s.shards.sub(before.add(spent)).abs().lt(D(1e-9))).toBe(true);
    expect(Object.keys(s.starChart)).toHaveLength(0);
    expect(starGlobalMult(s).eq(ONE)).toBe(true);
  });

  /**
   * The geometric-series refund is the part that is easy to get wrong once
   * nodes have ranks: refunding `baseCost × rank` would quietly mint Shards
   * for every node past rank 1.
   */
  it('the refund is exact, not the base cost times the rank', () => {
    const s = rich();
    s.shards = D('1e9');
    const start = s.shards;
    for (let i = 0; i < 5; i++) buyStarNode(s, 'ignite');
    respecStarChart(s);
    expect(s.shards.sub(start).abs().div(start).lt(D(1e-9))).toBe(true);
  });
});
