import { BAL } from '../balance';
import { D, ONE, ZERO } from '../numbers';
import { defaultState } from '../state';
import { prismMult } from '../systems/multipliers';
import {
  ascendGain,
  ascendUnlocked,
  buyPrismUpgrade,
  canAscend,
  doAscend,
} from '../systems/prestige';

function readyState() {
  const s = defaultState(0);
  s.shards = D(180);
  s.bestShards = D(180);
  s.shardsEver = D(180);
  s.collapses = 5;
  s.shardUpgrades = { swiftServos: 2 };
  s.starChart = { ignite: true };
  s.spark = D(1e7);
  s.bestSparkRun = D(1e7);
  s.dims[0] = { bought: 10, amount: D(500), unlocked: true };
  s.motes = D(300);
  s.elements = { points: 0, alloc: {}, progress: 0 };
  return s;
}

describe('ascend gating & gain', () => {
  it('locked below the shard threshold', () => {
    const s = defaultState(0);
    s.shardsEver = BAL.ascend.unlockShards.sub(1);
    expect(ascendUnlocked(s)).toBe(false);
    expect(ascendGain(s).eq(ZERO)).toBe(true);
    expect(doAscend(s)).toBe(false);
  });

  it('gain follows floor(sqrt(shardsEver/coef)) + dim bonus', () => {
    const s = readyState();
    expect(ascendGain(s).toNumber()).toBe(3); // sqrt(180/20) = 3
    s.challenges = { dim: 2 };
    expect(ascendGain(s).toNumber()).toBe(5);
  });

  it('spending Shards on the Star Chart never delays Ascend', () => {
    const s = readyState();
    s.shards = ZERO; // all invested in nodes
    expect(ascendUnlocked(s)).toBe(true);
    expect(canAscend(s)).toBe(true);
  });
});

describe('ascend reset semantics', () => {
  it('resets the whole P1 layer plus layer 0; keeps P2 and lifetime stats', () => {
    const s = readyState();
    expect(doAscend(s)).toBe(true);

    // gained
    expect(s.prism.toNumber()).toBe(3);
    expect(s.prismEver.toNumber()).toBe(3);
    expect(s.ascends).toBe(1);
    expect(s.elements.points).toBe(BAL.elements.pointsPerAscend);

    // P1 layer gone — including the shard multiplier's source
    expect(s.shards.eq(ZERO)).toBe(true);
    expect(s.bestShards.eq(ZERO)).toBe(true);
    expect(s.shardsEver.eq(ZERO)).toBe(true);
    expect(s.shardUpgrades).toEqual({});
    expect(s.starChart).toEqual({});

    // layer 0 reset with the plain restart grant (perks were cleared first)
    expect(s.spark.eq(BAL.dimBoost.startingSpark)).toBe(true);
    expect(s.dims[0].amount.eq(ZERO)).toBe(true);
    expect(s.motes.eq(ZERO)).toBe(true);

    // lifetime stats kept
    expect(s.collapses).toBe(5);
  });

  it('ascending abandons an active challenge without completing it', () => {
    const s = readyState();
    s.ascends = 1; // challenges are unlocked
    s.shardsEver = D(180); // readyState values survive the reset above
    s.activeChallenge = 'famine';
    doAscend(s);
    expect(s.activeChallenge).toBeNull();
    expect(s.challenges['famine'] ?? 0).toBe(0);
  });
});

describe('prism multiplier & grid', () => {
  it('2^prismEver, exponent softcapped', () => {
    const s = defaultState(0);
    expect(prismMult(s).eq(ONE)).toBe(true);
    s.prismEver = D(3);
    expect(prismMult(s).toNumber()).toBe(8);
    s.prismEver = D(240); // above t=60: 60·(240/60)^0.5 = 120
    expect(prismMult(s).eq(D(2).pow(120))).toBe(true);
  });

  it('spending prism on the grid does not reduce prismMult', () => {
    const s = defaultState(0);
    s.prism = D(10);
    s.prismEver = D(10);
    const before = prismMult(s);
    expect(buyPrismUpgrade(s, 'amplify')).toBe(true);
    expect(s.prism.toNumber()).toBe(8);
    expect(s.prismGrid.amplify).toBe(1);
    expect(prismMult(s).eq(before)).toBe(true);
  });

  it('grid purchases fail when broke or unknown', () => {
    const s = defaultState(0);
    expect(buyPrismUpgrade(s, 'amplify')).toBe(false);
    s.prism = D(100);
    expect(buyPrismUpgrade(s, 'nonsense')).toBe(false);
  });
});
