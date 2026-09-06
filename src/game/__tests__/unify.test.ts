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
  unifyGates,
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
  // Past the Unify Trial gate, and past the Deep Refinement gate: since the
  // Phase 12 rebalance those are two of Unify's four doors (BAL.gates).
  s.challenges = { famine: 8, dim: 8 };
  s.researchGrid = { deepRefine: BAL.gates.unifyRefineLevels };
  s.shards = D(1e4);
  s.shardsEver = D(1e5);
  s.collapses = 50;
  s.spark = D('1e50');
  s.bestSparkRun = D('1e50');
  return s;
}

describe('unify gating & gain', () => {
  /**
   * Four gates from four different systems. The point of `unifyGates` is that
   * "why can't I Unify" has four possible answers and the UI has to be able to
   * name the right one, so the shape of that list is part of the contract.
   */
  it('needs all four gates: aeon, the seed, trials and refinement', () => {
    const s = defaultState(0);
    s.aeonEver = BAL.unify.unlockAeon.add(2);
    expect(unifyUnlocked(s)).toBe(true); // card shows
    expect(canUnify(s)).toBe(false); // the other three doors are shut
    expect(unifyGates(s).filter((g) => !g.met).map((g) => g.id)).toEqual([
      'seed',
      'trials',
      'refine',
    ]);

    s.research = { singularitySeed: true };
    s.challenges = { famine: 8, dim: 8 };
    s.researchGrid = { deepRefine: BAL.gates.unifyRefineLevels };
    expect(unifyGates(s).every((g) => g.met)).toBe(true);
    expect(canUnify(s)).toBe(true);
  });

  it('reads lifetime Aeon, so buying the Aeon tree cannot lock Unify away', () => {
    const s = defaultState(0);
    s.aeonEver = BAL.unify.unlockAeon;
    s.aeon = ZERO; // the whole tree has been bought
    s.research = { singularitySeed: true };
    s.challenges = { famine: 8, dim: 8 };
    s.researchGrid = { deepRefine: BAL.gates.unifyRefineLevels };
    expect(canUnify(s)).toBe(true);
  });

  it('gain follows floor((aeonEver/coef)^exp) above the unlock threshold', () => {
    const s = defaultState(0);
    const gainAt = (aeon: number) => {
      s.aeonEver = D(aeon);
      return unifyGain(s).toNumber();
    };
    const expected = (aeon: number) =>
      Math.floor(Math.pow(aeon / BAL.unify.coef.toNumber(), BAL.unify.exp));

    // The first one is cheap on purpose; the tail is long but walkable.
    expect(gainAt(BAL.unify.unlockAeon.toNumber())).toBeGreaterThanOrEqual(1);
    expect(gainAt(BAL.unify.unlockAeon.toNumber())).toBe(
      expected(BAL.unify.unlockAeon.toNumber()),
    );
    expect(gainAt(1500)).toBe(expected(1500));
    expect(gainAt(1500)).toBeGreaterThan(gainAt(300));

    s.aeonEver = BAL.unify.unlockAeon.sub(1);
    expect(unifyGain(s).eq(ZERO)).toBe(true); // below unlock
  });
});

describe('unify reset semantics', () => {
  it('resets everything; keeps singularity, meta, points, trial rewards, stats', () => {
    const s = readyState();
    expect(doUnify(s)).toBe(true);

    const gain = Math.floor(Math.pow(45 / BAL.unify.coef.toNumber(), BAL.unify.exp));
    expect(s.singularity.toNumber()).toBe(gain);
    expect(s.singularityEver.toNumber()).toBe(gain);
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
    expect(s.challenges).toEqual({ famine: 8, dim: 8 });

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
    expect(s.aeon.toNumber()).toBe(5);
    expect(s.aeonEver.toNumber()).toBe(5);
  });

  /**
   * Buried Fleet and Fixed Heaven are the two keeps the endgame actually turns
   * on: without them a Unify wipes lifetime Ore (a power-law multiplier worth
   * five orders of magnitude) and every ranked Star Chart node (where the two
   * gain-rate accelerators live), and the second cycle runs slower than the
   * first. That is why they are the cheapest things in the shop.
   */
  it('buried fleet keeps the mining lane; fixed heaven keeps the chart', () => {
    const s = readyState();
    s.oreEver = D(1e9);
    s.starChart = { ignite: 4 };
    s.metaShop = { keepMiners: true, keepChart2: true };
    doUnify(s);
    expect(s.ore.toNumber()).toBe(5000);
    expect(s.oreEver.toNumber()).toBe(1e9);
    expect(s.miners).toEqual({ drill: 8 });
    expect(s.starChart).toEqual({ ignite: 4 });
  });

  it('without them, the mining lane and the chart are gone', () => {
    const s = readyState();
    s.oreEver = D(1e9);
    s.starChart = { ignite: 4 };
    doUnify(s);
    expect(s.oreEver.eq(ZERO)).toBe(true);
    expect(s.miners).toEqual({});
    expect(s.starChart).toEqual({});
  });
});

describe('singularity multiplier', () => {
  /**
   * `multPer` is enormous (1e7) and has to be: Unify takes away Aeon, Prism
   * and the whole Star Chart, which at the gate are worth ~1e20 between them.
   * A top layer that pays less than it costs is a button whose only reward is
   * that it is required — see BAL.unify.
   */
  it('compounds per lifetime singularity, persists across resets, reaches globalMult', () => {
    const s = defaultState(0);
    const per = BAL.unify.multPer;
    expect(singularityMult(s).eq(ONE)).toBe(true);
    s.singularityEver = D(2);
    expect(singularityMult(s).eq(per.pow(2))).toBe(true);
    expect(globalMult(s).gte(per.pow(2))).toBe(true);

    // spending singularity must not reduce it
    s.singularity = ZERO;
    expect(singularityMult(s).eq(per.pow(2))).toBe(true);
  });

  it('singular engine and eternal flame multiply on top', () => {
    const s = defaultState(0);
    s.singularityEver = D(1);
    s.metaShop = { metaEngine: true };
    expect(singularityMult(s).eq(BAL.unify.multPer.mul(5))).toBe(true);
    s.metaGrid = { eternalFlame: 2 };
    expect(singularityMult(s).eq(BAL.unify.multPer.mul(5).mul(100))).toBe(true);
  });
});

describe('meta shop', () => {
  it('one-time purchases with singularity', () => {
    const s = defaultState(0);
    s.singularity = D(3);
    const archive = BAL.metaShop.find((m) => m.id === 'keepResearch')!;
    expect(buyMetaUpgrade(s, 'keepResearch')).toBe(true);
    expect(s.singularity.eq(D(3).sub(archive.cost))).toBe(true);
    expect(metaOwned(s, 'keepResearch')).toBe(true);
    expect(buyMetaUpgrade(s, 'keepResearch')).toBe(false);
    expect(buyMetaUpgrade(s, 'autoUnify')).toBe(false); // out of reach at 3
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
    // Converge's own sideways gate: cleared Trials (BAL.gates).
    s.challenges = { solitary: BAL.gates.convergeTrialTiers };
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
