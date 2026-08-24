import { BAL } from '../balance';
import { D, ONE, ZERO } from '../numbers';
import { defaultState } from '../state';
import { tickDimensions } from '../systems/dimensions';
import { shardMult } from '../systems/multipliers';
import {
  buyShardUpgrade,
  canCollapse,
  collapseGain,
  collapseUnlocked,
  doCollapse,
} from '../systems/prestige';
import { emberStartSpark, keptDimBoosts, moteKeepFraction } from '../systems/shardperks';

describe('collapse gain & gating', () => {
  it('locked below the unlock threshold', () => {
    const s = defaultState(0);
    s.bestSparkRun = BAL.collapse.unlockSpark.sub(1);
    expect(collapseUnlocked(s)).toBe(false);
    expect(collapseGain(s).eq(ZERO)).toBe(true);
    expect(canCollapse(s)).toBe(false);
    expect(doCollapse(s)).toBe(false);
  });

  it('gain is logarithmic: a fixed number of Spark decades per Shard', () => {
    const s = defaultState(0);
    // floor(perDecade · log10(best / 1e4)); perDecade = 0.7
    s.bestSparkRun = D(1e6); // 2 decades → 1
    expect(collapseGain(s).toNumber()).toBe(1);
    s.bestSparkRun = D('1e14'); // 10 decades → 7
    expect(collapseGain(s).toNumber()).toBe(7);
    s.bestSparkRun = D('1e104'); // 100 decades → 70
    expect(collapseGain(s).toNumber()).toBe(70);
    // Explosive Spark must NOT mean explosive Shards — that is the whole point.
    s.bestSparkRun = D('1e1004');
    expect(collapseGain(s).toNumber()).toBe(700);
  });

  it('stays unlocked forever after the first collapse', () => {
    const s = defaultState(0);
    s.bestSparkRun = D(1e6);
    doCollapse(s);
    expect(s.bestSparkRun.lt(BAL.collapse.unlockSpark)).toBe(true);
    expect(collapseUnlocked(s)).toBe(true);
  });
});

describe('collapse reset semantics (spec §19: exactly the specified fields)', () => {
  function playedState() {
    const s = defaultState(0);
    s.spark = D(5e6);
    s.bestSparkRun = D(5e6);
    s.totalSpark = D(9e6);
    s.dims[0] = { bought: 30, amount: D(1000), unlocked: true };
    s.sparkUpgrades = { fluxLattice: 5 };
    s.dimBoosts = 2;
    s.motes = D(100);
    s.motesEver = D(200);
    s.moteUpgrades = { focus: 3 };
    s.starChart = { ignite: true };
    s.automation = { dim1: false };
    s.totalTaps = 50;
    return s;
  }

  it('resets layer 0, keeps everything above', () => {
    const s = playedState();
    expect(doCollapse(s)).toBe(true);

    // reset — spark drops to the restart grant (one Tier-1 orbiter's worth)
    expect(s.spark.eq(BAL.dimBoost.startingSpark)).toBe(true);
    expect(s.bestSparkRun.eq(s.spark)).toBe(true);
    expect(s.dims[0].bought).toBe(0);
    expect(s.dims[0].amount.eq(ZERO)).toBe(true);
    expect(s.sparkUpgrades).toEqual({});
    expect(s.dimBoosts).toBe(0);
    expect(s.motes.eq(ZERO)).toBe(true);
    expect(s.moteUpgrades).toEqual({});

    // kept
    expect(s.shards.toNumber()).toBeGreaterThan(0);
    expect(s.totalSpark.eq(D(9e6))).toBe(true);
    expect(s.motesEver.eq(D(200))).toBe(true);
    expect(s.starChart.ignite).toBe(true);
    expect(s.automation.dim1).toBe(false);
    expect(s.totalTaps).toBe(50);
    expect(s.collapses).toBe(1);
  });

  it('tier unlocks fall back to the starting set', () => {
    const s = playedState();
    doCollapse(s);
    s.dims.forEach((d, i) => expect(d.unlocked).toBe(i < BAL.startingTiers));
  });

  it('shard perks soften the reset: ember bank, mote echo, boost echo', () => {
    const s = playedState();
    s.shardUpgrades = { emberBank: 2, moteEcho: 2, boostEcho: 1 };
    doCollapse(s);
    expect(s.spark.eq(D(1000))).toBe(true); // 100·10^(2−1)
    expect(s.motes.eq(D(40))).toBe(true); // kept 40%
    expect(s.dimBoosts).toBe(1);
    expect(s.dims[BAL.startingTiers].unlocked).toBe(true); // kept boost keeps its tier
  });

  it('shard multiplier is recomputed from lifetime shards, never carried', () => {
    const s = playedState();
    doCollapse(s);
    const expected = ONE.add(BAL.collapse.multPerShard.mul(s.shardsEver));
    expect(shardMult(s).sub(expected).abs().lt(D(1e-9))).toBe(true);

    // spending shards must NOT reduce the multiplier (drives §10 re-run pacing)
    const before = shardMult(s);
    s.shards = ZERO;
    expect(shardMult(s).eq(before)).toBe(true);

    // and it actually multiplies production
    const boosted = defaultState(0);
    boosted.shardsEver = D(4); // ×2
    boosted.dims[0].amount = D(10);
    const plain = defaultState(0);
    plain.dims[0].amount = D(10);
    tickDimensions(boosted, 1);
    tickDimensions(plain, 1);
    expect(boosted.spark.div(plain.spark).sub(D(2)).abs().lt(D(1e-9))).toBe(true);
  });

  it('shard multiplier is softcapped', () => {
    const s = defaultState(0);
    s.shardsEver = D(1e9);
    const uncapped = ONE.add(BAL.collapse.multPerShard.mul(s.shardsEver));
    expect(shardMult(s).lt(uncapped)).toBe(true);
    expect(shardMult(s).gte(BAL.softcap.shard.t)).toBe(true);
  });
});

describe('shard upgrades', () => {
  it('purchase deducts shards and respects max level', () => {
    const s = defaultState(0);
    const def = BAL.shardUpgrades.find((u) => u.id === 'swiftServos')!;
    s.shards = def.baseCost;
    expect(buyShardUpgrade(s, 'swiftServos')).toBe(true);
    expect(s.shards.eq(ZERO)).toBe(true);
    expect(s.shardUpgrades.swiftServos).toBe(1);

    s.shardUpgrades = { swiftServos: def.maxLevel! };
    s.shards = D(1e6);
    expect(buyShardUpgrade(s, 'swiftServos')).toBe(false);
  });

  it('perk helpers: level 0 means no effect', () => {
    const s = defaultState(0);
    expect(emberStartSpark(s).eq(ZERO)).toBe(true);
    expect(moteKeepFraction(s)).toBe(0);
    expect(keptDimBoosts(s)).toBe(0);
  });
});
