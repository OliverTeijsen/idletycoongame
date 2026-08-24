import { BAL } from '../balance';
import { D, ZERO } from '../numbers';
import { deserializeState, serializeState } from '../save';
import { CURRENT_VERSION, defaultState } from '../state';
import { TIER_COUNT } from '../systems/dimensions';

describe('roundtrip', () => {
  it('a played state survives serialize → deserialize', () => {
    const s = defaultState(1000);
    s.spark = D('1.5e42');
    s.bestSparkRun = D('2e42');
    s.totalSpark = D('9e42');
    s.dims[0] = { bought: 25, amount: D('1e6'), unlocked: true };
    s.dims[3] = { bought: 2, amount: D(2), unlocked: true };
    s.sparkUpgrades = { fluxLattice: 7, ignition: 2 };
    s.dimBoosts = 2;
    s.totalTaps = 321;
    s.motes = D(123.5);
    s.motesEver = D(500);
    s.moteUpgrades = { focus: 3 };
    s.options = {
      notation: 'scientific',
      reducedMotion: true,
      confirmResets: false,
      muted: true,
      volume: 0.3,
      showOfflineSummary: false,
    };
    s.timePlayed = 5432;

    s.shards = D(77);
    s.bestShards = D(80);
    s.shardsEver = D(120);
    s.collapses = 3;
    s.shardUpgrades = { swiftServos: 2 };
    s.starChart = { ignite: true, kindling: true };
    s.automation = { dim1: false };

    const back = deserializeState(serializeState(s), 2000)!;
    expect(back).not.toBeNull();
    expect(back.spark.eq(s.spark)).toBe(true);
    expect(back.shards.eq(D(77))).toBe(true);
    expect(back.collapses).toBe(3);
    expect(back.shardUpgrades).toEqual({ swiftServos: 2 });
    expect(back.starChart).toEqual({ ignite: true, kindling: true });
    expect(back.automation).toEqual({ dim1: false });
    expect(back.dims[0].bought).toBe(25);
    expect(back.dims[0].amount.eq(D('1e6'))).toBe(true);
    expect(back.sparkUpgrades).toEqual(s.sparkUpgrades);
    expect(back.dimBoosts).toBe(2);
    expect(back.motes.eq(s.motes)).toBe(true);
    expect(back.moteUpgrades).toEqual(s.moteUpgrades);
    expect(back.options).toEqual(s.options);
    expect(back.timePlayed).toBe(5432);
    // tier unlocks are recomputed from dimBoosts, not trusted from the save
    expect(back.dims[BAL.startingTiers + 1].unlocked).toBe(true);
    expect(back.dims[BAL.startingTiers + 2].unlocked).toBe(false);
  });
});

describe('untrusted input', () => {
  it('rejects garbage outright', () => {
    expect(deserializeState('not json')).toBeNull();
    expect(deserializeState('42')).toBeNull();
    expect(deserializeState('[]')).toBeNull();
    expect(deserializeState('{}')).toBeNull(); // no spark field
    expect(deserializeState('null')).toBeNull();
  });

  it('rejects a save from a future version', () => {
    const s = serializeState(defaultState(0));
    const doc = JSON.parse(s);
    doc.version = CURRENT_VERSION + 1;
    expect(deserializeState(JSON.stringify(doc))).toBeNull();
  });

  it('clamps tampered values instead of importing them', () => {
    const doc = JSON.parse(serializeState(defaultState(0)));
    doc.spark = 'NaN';
    doc.dimBoosts = -5;
    doc.totalTaps = 'lots';
    doc.dims[0] = { bought: -3, amount: '-1e10' };
    doc.sparkUpgrades = { ignition: 9999, hacked: 5 };
    doc.starChart = { ignite: 'yes', fakeNode: true, kindling: true };
    doc.automation = { dim1: 'off', hacked: true };
    doc.shardUpgrades = { swiftServos: 9999 };
    doc.options = { notation: 'roman', reducedMotion: 'yes', confirmResets: null };

    const back = deserializeState(JSON.stringify(doc), 0)!;
    expect(back).not.toBeNull();
    expect(back.spark.eq(ZERO)).toBe(true);
    expect(back.dimBoosts).toBe(0);
    expect(back.totalTaps).toBe(0);
    expect(back.dims[0].bought).toBe(0);
    expect(back.dims[0].amount.eq(ZERO)).toBe(true);
    const ignitionDef = BAL.sparkUpgrades.find((u) => u.id === 'ignition')!;
    expect(back.sparkUpgrades.ignition).toBe(ignitionDef.maxLevel);
    expect(back.sparkUpgrades.hacked).toBeUndefined();
    // star chart: non-true and unknown entries dropped, valid ones kept
    expect(back.starChart).toEqual({ kindling: true });
    // automation: non-boolean and unknown ids dropped
    expect(back.automation).toEqual({});
    // shard upgrade clamped to its max
    const servosDef = BAL.shardUpgrades.find((u) => u.id === 'swiftServos')!;
    expect(back.shardUpgrades.swiftServos).toBe(servosDef.maxLevel);
    expect(back.options.notation).toBe('standard');
    expect(back.options.reducedMotion).toBe(false);
  });

  it('a save missing new fields fills from defaults (additive migration)', () => {
    const doc = JSON.parse(serializeState(defaultState(0)));
    delete doc.motes;
    delete doc.motesEver;
    delete doc.moteUpgrades;
    delete doc.options;
    delete doc.timePlayed;
    const back = deserializeState(JSON.stringify(doc), 0)!;
    expect(back).not.toBeNull();
    expect(back.motes.eq(ZERO)).toBe(true);
    expect(back.moteUpgrades).toEqual({});
    expect(back.options.confirmResets).toBe(true);
  });

  it('savedAt in the future is clamped to now (no offline minting)', () => {
    const doc = JSON.parse(serializeState(defaultState(0)));
    doc.savedAt = 999999999;
    const back = deserializeState(JSON.stringify(doc), 1000)!;
    expect(back.savedAt).toBe(1000);
  });

  it('dims array always comes back with TIER_COUNT entries', () => {
    const doc = JSON.parse(serializeState(defaultState(0)));
    doc.dims = doc.dims.slice(0, 2); // truncated save
    const back = deserializeState(JSON.stringify(doc), 0)!;
    expect(back).not.toBeNull();
    expect(back.dims).toHaveLength(TIER_COUNT);

    doc.dims = null;
    const back2 = deserializeState(JSON.stringify(doc), 0)!;
    expect(back2).not.toBeNull();
    expect(back2.dims).toHaveLength(TIER_COUNT);
  });
});
