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
  s.prism = D(200);
  s.bestPrism = D(200);
  s.prismEver = READY_PRISM;
  s.ascends = 3;
  s.prismGrid = { amplify: 2 };
  s.elements = { points: 1, alloc: { ignis: 4, lux: 2 }, progress: 100 };
  // Converge's sideways gate: cleared Trial tiers (BAL.gates).
  s.challenges = { famine: 8 };
  s.shards = D(500);
  s.shardsEver = D(900);
  s.shardUpgrades = { emberBank: 3 };
  s.starChart = { ignite: 1 };
  s.ore = D(1234);
  s.miners = { drill: 5 };
  s.research = { oreSluice: true };
  s.spark = D('1e20');
  s.bestSparkRun = D('1e20');
  s.collapses = 20;
  return s;
}

/** Well above the Converge bar, so the gain is a real number to assert on. */
const READY_PRISM = BAL.converge.unlockPrism.mul(4);

describe('converge gating & gain', () => {
  it('locked below the prism threshold', () => {
    const s = defaultState(0);
    s.prismEver = BAL.converge.unlockPrism.sub(1);
    expect(convergeUnlocked(s)).toBe(false);
    expect(convergeGain(s).eq(ZERO)).toBe(true);
    expect(doConverge(s)).toBe(false);
  });

  /**
   * A POWER law, not a log. The point is that six times the Prism must be
   * worth well over six-fifths the Aeon, or a Converge stops ever being worth
   * taking and the whole ladder above it seizes — see BAL.converge for the
   * fourteen-hour walk where exactly that happened.
   */
  it('gain is floor((prismEver/coef)^exp) — sublinear, but not a log', () => {
    const s = defaultState(0);
    const expected = (prism: number) =>
      Math.floor(Math.pow(prism / BAL.converge.coef.toNumber(), BAL.converge.exp));

    s.prismEver = D(200);
    expect(convergeGain(s).toNumber()).toBe(expected(200));
    const small = convergeGain(s).toNumber();
    s.prismEver = D(1200);
    expect(convergeGain(s).toNumber()).toBe(expected(1200));
    expect(convergeGain(s).toNumber()).toBeGreaterThan(small * 2);
  });

  /**
   * The Trial gate. Prism alone is not enough to go deeper any more: this is
   * the sideways interlock that makes the Trials tab part of the ladder rather
   * than a side cabinet (BAL.gates).
   */
  it('also needs cleared Trial tiers', () => {
    const s = defaultState(0);
    s.prismEver = READY_PRISM;
    s.prism = s.prismEver;
    expect(convergeGain(s).gte(1)).toBe(true);
    expect(canConverge(s)).toBe(false);
    s.challenges = { solitary: BAL.gates.convergeTrialTiers };
    expect(canConverge(s)).toBe(true);
  });

  it('spending Prism on the grid never delays Converge', () => {
    const s = defaultState(0);
    s.prismEver = READY_PRISM;
    s.prism = ZERO; // everything already spent
    s.challenges = { solitary: BAL.gates.convergeTrialTiers };
    expect(convergeUnlocked(s)).toBe(true);
    expect(canConverge(s)).toBe(true);
  });
});

describe('converge reset semantics', () => {
  it('resets P2+P1+L0+minerals; keeps aeon, research, points, trial rewards', () => {
    const s = readyState();
    expect(canConverge(s)).toBe(true);
    expect(doConverge(s)).toBe(true);

    const gain = Math.floor(
      Math.pow(READY_PRISM.toNumber() / BAL.converge.coef.toNumber(), BAL.converge.exp),
    );
    expect(s.aeon.toNumber()).toBe(gain);
    expect(s.aeonEver.toNumber()).toBe(gain);
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

    // MINERALS SURVIVE a Converge now — they are the slow lane, and wiping
    // them roughly hourly is what made mining pointless (see systems/minerals).
    expect(s.ore.eq(D(1234))).toBe(true);
    expect(s.miners).toEqual({ drill: 5 });
    expect(s.research).toEqual({ oreSluice: true });

    // kept
    expect(s.challenges).toEqual({ famine: 8 });
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
    s.shardsEver = BAL.ascend.unlockShards.mul(2);
    s.shards = s.shardsEver;
    s.motes = D(1000);
    s.starChart = { ignite: 1, kindling: 1 };
    s.aeonTree = { keepMotes: true, keepChart: true };
    expect(doAscend(s)).toBe(true);
    expect(s.motes.eq(D(500))).toBe(true);
    expect(s.starChart).toEqual({ ignite: 1, kindling: 1 });
  });
});
