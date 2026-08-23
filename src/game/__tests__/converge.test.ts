import { BAL } from '../balance';
import { D, ONE, ZERO } from '../numbers';
import { offlineCapSeconds } from '../offline';
import { defaultState } from '../state';
import { aeonMult } from '../systems/multipliers';
import {
  aeonNodeOwned,
  buyAeonNode,
  canConverge,
  convergeGain,
  convergeUnlocked,
  doAscend,
  doConverge,
} from '../systems/prestige';

function readyState() {
  const s = defaultState(0);
  s.prism = D(35);
  s.bestPrism = D(35);
  s.prismEver = D(60);
  s.ascends = 3;
  s.prismGrid = { amplify: 2 };
  s.elements = { points: 1, alloc: { ignis: 4, lux: 2 }, progress: 100 };
  s.challenges = { famine: 2 };
  s.shards = D(500);
  s.shardsEver = D(900);
  s.shardUpgrades = { emberBank: 3 };
  s.starChart = { ignite: true };
  s.ore = D(1234);
  s.miners = { drill: 5 };
  s.research = { oreSluice: true };
  s.spark = D('1e20');
  s.bestSparkRun = D('1e20');
  s.collapses = 20;
  return s;
}

describe('converge gating & gain', () => {
  it('locked below 30 prism', () => {
    const s = defaultState(0);
    s.bestPrism = BAL.converge.unlockPrism.sub(1);
    expect(convergeUnlocked(s)).toBe(false);
    expect(convergeGain(s).eq(ZERO)).toBe(true);
    expect(doConverge(s)).toBe(false);
  });

  it('gain is floor(log2(bestPrism + 1)) — slow on purpose', () => {
    const s = defaultState(0);
    s.bestPrism = D(31); // log2(32) = 5
    expect(convergeGain(s).toNumber()).toBe(5);
    s.bestPrism = D(1023);
    expect(convergeGain(s).toNumber()).toBe(10);
  });
});

describe('converge reset semantics', () => {
  it('resets P2+P1+L0+minerals; keeps aeon, research, points, trial rewards', () => {
    const s = readyState();
    expect(canConverge(s)).toBe(true);
    expect(doConverge(s)).toBe(true);

    // gained: log2(36) = 5
    expect(s.aeon.toNumber()).toBe(5);
    expect(s.aeonEver.toNumber()).toBe(5);
    expect(s.converges).toBe(1);

    // P2 layer gone
    expect(s.prism.eq(ZERO)).toBe(true);
    expect(s.prismEver.eq(ZERO)).toBe(true);
    expect(s.prismGrid).toEqual({});
    // element allocation refunded to the pool, points kept
    expect(s.elements.alloc).toEqual({});
    expect(s.elements.points).toBe(7); // 1 + 4 + 2

    // P1 + L0 gone
    expect(s.shards.eq(ZERO)).toBe(true);
    expect(s.shardsEver.eq(ZERO)).toBe(true);
    expect(s.shardUpgrades).toEqual({});
    expect(s.starChart).toEqual({});
    expect(s.spark.eq(BAL.dimBoost.startingSpark)).toBe(true);

    // minerals reset, research SURVIVES
    expect(s.ore.eq(ZERO)).toBe(true);
    expect(s.miners).toEqual({});
    expect(s.research).toEqual({ oreSluice: true });

    // kept
    expect(s.challenges).toEqual({ famine: 2 });
    expect(s.ascends).toBe(3);
    expect(s.collapses).toBe(20);
  });
});

describe('aeon effects', () => {
  it('aeon multiplies tiers and raises the offline cap (lifetime-based)', () => {
    const s = defaultState(0);
    const capBefore = offlineCapSeconds(s);
    expect(aeonMult(s).eq(ONE)).toBe(true);
    s.aeonEver = D(4);
    expect(aeonMult(s).eq(BAL.converge.tierMultPer.pow(4))).toBe(true);
    expect(offlineCapSeconds(s) - capBefore).toBe(4 * BAL.converge.offlineCapHPer * 3600);

    // spending aeon must not reduce it
    s.aeon = D(4);
    s.aeon = ZERO;
    expect(aeonMult(s).eq(BAL.converge.tierMultPer.pow(4))).toBe(true);
  });

  it('aeon tree: buy once, deep engine doubles', () => {
    const s = defaultState(0);
    s.aeon = D(10);
    s.aeonEver = D(10);
    const before = aeonMult(s);
    expect(buyAeonNode(s, 'dimPower')).toBe(true);
    expect(aeonNodeOwned(s, 'dimPower')).toBe(true);
    expect(aeonMult(s).div(before).sub(D(2)).abs().lt(D(1e-9))).toBe(true);
    expect(buyAeonNode(s, 'dimPower')).toBe(false); // one-time
    expect(buyAeonNode(s, 'nonsense')).toBe(false);
  });

  it('mote memory and fixed stars survive an Ascend', () => {
    const s = defaultState(0);
    s.ascends = 0;
    s.bestShards = D(100);
    s.shards = D(100);
    s.motes = D(1000);
    s.starChart = { ignite: true, kindling: true };
    s.aeonTree = { keepMotes: true, keepChart: true };
    expect(doAscend(s)).toBe(true);
    expect(s.motes.eq(D(500))).toBe(true);
    expect(s.starChart).toEqual({ ignite: true, kindling: true });
  });
});
