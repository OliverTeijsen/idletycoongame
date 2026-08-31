import { BAL } from '../balance';
import { D, ONE, ZERO } from '../numbers';
import { defaultState } from '../state';
import { autobuyerAvailable, tickAutomation } from '../systems/automation';
import { globalMult, singularityMult } from '../systems/multipliers';
import {
  buyMetaUpgrade,
  canUnify,
  doUnify,
  metaOwned,
  unifyGain,
  unifyUnlocked,
} from '../systems/prestige';

function readyState() {
  const s = defaultState(0);
  s.aeon = D(45);
  s.bestAeon = D(45);
  s.aeonEver = D(45);
  s.converges = 4;
  s.aeonTree = { dimPower: true };
  s.research = { singularitySeed: true, oreSluice: true, slotA: true };
  s.ore = D(5000);
  s.miners = { drill: 8 };
  s.flux = D(300);
  s.warpRemaining = 100;
  s.boostSlots = ['kindler', 'weaver'];
  s.prism = D(100);
  s.bestPrism = D(100);
  s.prismEver = D(200);
  s.ascends = 10;
  s.elements = { points: 3, alloc: { lux: 5 }, progress: 0 };
  s.challenges = { famine: 2, dim: 1 };
  s.shards = D(1e4);
  s.shardsEver = D(1e5);
  s.collapses = 50;
  s.spark = D('1e50');
  s.bestSparkRun = D('1e50');
  return s;
}

describe('unify gating & gain', () => {
  it('needs the aeon threshold AND the singularity seed', () => {
    const s = defaultState(0);
    s.aeonEver = BAL.unify.unlockAeon.add(2);
    expect(unifyUnlocked(s)).toBe(true); // card shows
    expect(canUnify(s)).toBe(false); // but the seed gates the button
    s.research = { singularitySeed: true };
    expect(canUnify(s)).toBe(true);
  });

  it('reads lifetime Aeon, so buying the Aeon tree cannot lock Unify away', () => {
    const s = defaultState(0);
    s.aeonEver = BAL.unify.unlockAeon;
    s.aeon = ZERO; // the whole tree has been bought
    s.research = { singularitySeed: true };
    expect(canUnify(s)).toBe(true);
  });

  it('gain follows floor((aeonEver/coef)^exp) above the unlock threshold', () => {
    const s = defaultState(0);
    s.aeonEver = BAL.unify.unlockAeon; // 30 → (2.5)^0.55 → 1: the cheap first one
    expect(unifyGain(s).toNumber()).toBe(1);
    s.aeonEver = D(60);
    expect(unifyGain(s).toNumber()).toBe(2);
    s.aeonEver = D(1500);
    expect(unifyGain(s).toNumber()).toBe(14); // long tail, but a walkable one
    s.aeonEver = BAL.unify.unlockAeon.sub(1);
    expect(unifyGain(s).eq(ZERO)).toBe(true); // below unlock
  });
});

describe('unify reset semantics', () => {
  it('resets everything; keeps singularity, meta, points, trial rewards, stats', () => {
    const s = readyState();
    expect(doUnify(s)).toBe(true);

    expect(s.singularity.toNumber()).toBe(2); // (45/12)^0.55
    expect(s.singularityEver.toNumber()).toBe(2);
    expect(s.unifies).toBe(1);

    // P3 layer + minerals + research + flux gone
    expect(s.aeon.eq(ZERO)).toBe(true);
    expect(s.aeonEver.eq(ZERO)).toBe(true);
    expect(s.aeonTree).toEqual({});
    expect(s.ore.eq(ZERO)).toBe(true);
    expect(s.miners).toEqual({});
    expect(s.research).toEqual({});
    expect(s.flux.eq(ZERO)).toBe(true);
    expect(s.warpRemaining).toBe(0);

    // P2/P1/L0 gone
    expect(s.prismEver.eq(ZERO)).toBe(true);
    expect(s.shardsEver.eq(ZERO)).toBe(true);
    expect(s.spark.eq(BAL.dimBoost.startingSpark)).toBe(true);

    // element alloc refunded, points kept; trial rewards kept
    expect(s.elements.points).toBe(8); // 3 + 5
    expect(s.elements.alloc).toEqual({});
    expect(s.challenges).toEqual({ famine: 2, dim: 1 });

    // manager slots shrank with research — assignments trimmed to base slot
    expect(s.boostSlots).toEqual(['kindler']);

    // lifetime counters kept
    expect(s.ascends).toBe(10);
    expect(s.collapses).toBe(50);
  });

  it('eternal archive keeps research; deep memory grants starting aeon', () => {
    const s = readyState();
    s.metaShop = { keepResearch: true, starterAeon: true };
    doUnify(s);
    expect(s.research).toEqual({ singularitySeed: true, oreSluice: true, slotA: true });
    expect(s.aeon.toNumber()).toBe(2);
    expect(s.aeonEver.toNumber()).toBe(2);
  });
});

describe('singularity multiplier', () => {
  it('×10 per lifetime singularity, persists across resets, reaches globalMult', () => {
    const s = defaultState(0);
    expect(singularityMult(s).eq(ONE)).toBe(true);
    s.singularityEver = D(2);
    expect(singularityMult(s).toNumber()).toBe(100);
    expect(globalMult(s).gte(D(100))).toBe(true);

    // spending singularity must not reduce it
    s.singularity = ZERO;
    expect(singularityMult(s).toNumber()).toBe(100);
  });

  it('singular engine multiplies ×3 on top', () => {
    const s = defaultState(0);
    s.singularityEver = D(1);
    s.metaShop = { metaEngine: true };
    expect(singularityMult(s).toNumber()).toBe(30);
  });
});

describe('meta shop', () => {
  it('one-time purchases with singularity', () => {
    const s = defaultState(0);
    s.singularity = D(3);
    expect(buyMetaUpgrade(s, 'autoAscend')).toBe(true);
    expect(s.singularity.toNumber()).toBe(2);
    expect(metaOwned(s, 'autoAscend')).toBe(true);
    expect(buyMetaUpgrade(s, 'autoAscend')).toBe(false);
    expect(buyMetaUpgrade(s, 'metaEngine')).toBe(false); // costs 5
    expect(buyMetaUpgrade(s, 'nonsense')).toBe(false);
  });
});

describe('auto-prestige', () => {
  it('auto-ascend and auto-converge are gated on the meta shop', () => {
    const s = defaultState(0);
    s.collapses = 1;
    expect(autobuyerAvailable(s, 'autoAscend')).toBe(false);
    expect(autobuyerAvailable(s, 'autoConverge')).toBe(false);
    s.metaShop = { autoAscend: true, autoConverge: true };
    expect(autobuyerAvailable(s, 'autoAscend')).toBe(true);
    expect(autobuyerAvailable(s, 'autoConverge')).toBe(true);
  });

  it('auto-ascend fires on the pass when worthwhile', () => {
    const s = defaultState(0);
    s.collapses = 1;
    s.metaShop = { autoAscend: true };
    s.shardsEver = BAL.ascend.unlockShards.mul(2);
    s.shards = s.shardsEver;
    tickAutomation(s, 1);
    expect(s.ascends).toBe(1);
    expect(s.prism.gte(1)).toBe(true);
  });

  it('auto-converge fires and outranks a same-pass ascend', () => {
    const s = defaultState(0);
    s.collapses = 1;
    s.metaShop = { autoAscend: true, autoConverge: true };
    s.prismEver = BAL.converge.unlockPrism.mul(2);
    s.prism = s.prismEver;
    tickAutomation(s, 1);
    expect(s.converges).toBe(1);
    expect(s.aeon.gte(1)).toBe(true);
    // converge wiped prism — the ascend check must not have fired after it
    expect(s.ascends).toBe(0);
  });

  it('never auto-prestiges during a challenge run', () => {
    const s = defaultState(0);
    s.collapses = 1;
    s.ascends = 1;
    s.metaShop = { autoAscend: true };
    s.activeChallenge = 'famine';
    s.shardsEver = D(1e4);
    tickAutomation(s, 1);
    expect(s.ascends).toBe(1); // unchanged
  });
});
