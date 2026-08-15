/**
 * Persistence tests.
 *
 * react-native-mmkv detects Jest and swaps in an in-memory implementation, so
 * these exercise the real save/load path rather than a hand-written mock.
 *
 * The corrupt-input cases matter more than the happy path: a save that throws on
 * load bricks the app for a player with a big empire, which is the single worst
 * bug an idle game can ship.
 */
import { BUSINESSES, SAVE_VERSION } from '../../core/businesses';
import { advance, buy, createInitialState, hireManager, prestige } from '../../core/engine';
import { D, decToString } from '../../core/numbers';
import { availableInvestors, getPerk, totalPerkLevels } from '../../core/perks';
import type { GameState } from '../../core/types';
import {
  clearSave,
  deserializeState,
  hasSave,
  loadGame,
  saveGame,
  serializeState,
} from '../storage';

/** A save that has actually been played: cash, managers, investors, boost. */
function playedState(): GameState {
  let state = createInitialState(1_000);
  state = { ...state, cash: D('1.234e42'), lifetimeEarnings: D('9.87e45'), investors: 4_321 };
  state = buy(state, 'friet', 100);
  state = hireManager(state, 'friet');
  state = buy(state, 'wafel', 10);
  state = advance(state, 0.7).state;
  return { ...state, totalTaps: 912, prestigeCount: 7, lastActiveAt: 5_000 };
}

describe('codec', () => {
  it('round-trips every field of a played save', () => {
    const before = playedState();
    const after = deserializeState(serializeState(before), 10_000);

    expect(after).not.toBeNull();
    const s = after!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.cash.eq(before.cash)).toBe(true);
    expect(s.lifetimeEarnings.eq(before.lifetimeEarnings)).toBe(true);
    expect(s.investors).toBe(before.investors);
    expect(s.buyAmount).toBe(before.buyAmount);
    expect(s.prestigeCount).toBe(7);
    expect(s.totalTaps).toBe(912);
    expect(s.startedAt).toBe(1_000);
    expect(s.lastActiveAt).toBe(5_000);
    expect(s.businesses).toHaveLength(BUSINESSES.length);
    expect(s.businesses.map((b) => b.owned)).toEqual(before.businesses.map((b) => b.owned));
    expect(s.businesses.map((b) => b.managed)).toEqual(before.businesses.map((b) => b.managed));
  });

  it('keeps Decimal precision far past Number.MAX_SAFE_INTEGER', () => {
    const cash = D('6.02214076e307');
    const state = { ...createInitialState(0), cash };
    const restored = deserializeState(serializeState(state), 0)!;
    expect(restored.cash.eq(cash)).toBe(true);
    expect(decToString(restored.cash)).toBe(decToString(cash));
  });

  it('preserves in-flight cycle progress', () => {
    let state = createInitialState(0);
    state = { ...state, businesses: state.businesses.map((b, i) => (i === 0 ? { ...b, managed: true } : b)) };
    state = advance(state, 0.6).state; // 0.4 of a 1.5s cycle
    const restored = deserializeState(serializeState(state), 0)!;
    expect(restored.businesses[0].progress).toBeCloseTo(0.4, 9);
  });

  it('survives a prestiged save', () => {
    const state = prestige({ ...createInitialState(0), lifetimeEarnings: D(1e9) });
    const restored = deserializeState(serializeState(state), 0)!;
    expect(restored.investors).toBe(150);
    expect(restored.lifetimeEarnings.eq(D(1e9))).toBe(true);
  });
});

describe('codec — hostile input', () => {
  it('returns null for input that is not a save at all', () => {
    for (const junk of ['', 'not json', '[]', 'null', '42', '{"nope":1}', '{"cash":123}']) {
      expect(deserializeState(junk, 0)).toBeNull();
    }
  });

  it('fills in missing optional fields instead of failing', () => {
    const minimal = JSON.stringify({ cash: '500', businesses: [] });
    const s = deserializeState(minimal, 7_000)!;
    expect(s).not.toBeNull();
    expect(s.cash.eq(D(500))).toBe(true);
    expect(s.lifetimeEarnings.eq(D(0))).toBe(true);
    expect(s.investors).toBe(0);
    expect(s.businesses).toHaveLength(BUSINESSES.length);
    expect(s.businesses[0].owned).toBe(1); // fresh-state default
  });

  it('ignores unknown business ids and keeps the roster complete', () => {
    const json = JSON.stringify({
      cash: '0',
      businesses: [
        { id: 'kroket', owned: 999, managed: true },
        { id: 'wafel', owned: 12, managed: true },
      ],
    });
    const s = deserializeState(json, 0)!;
    expect(s.businesses).toHaveLength(BUSINESSES.length);
    expect(s.businesses.find((b) => b.id === 'wafel')!.owned).toBe(12);
    expect(s.businesses.some((b) => (b.id as string) === 'kroket')).toBe(false);
  });

  it('adds tiers that did not exist when the save was written', () => {
    // Forward compatibility for v1.3 regions: an old save lists only two tiers.
    const json = JSON.stringify({
      cash: '10',
      businesses: [
        { id: 'friet', owned: 50, progress: 0.2, managed: true, active: false },
        { id: 'wafel', owned: 3, progress: 0, managed: false, active: false },
      ],
    });
    const s = deserializeState(json, 0)!;
    expect(s.businesses).toHaveLength(BUSINESSES.length);
    expect(s.businesses.find((b) => b.id === 'empire')!.owned).toBe(0);
  });

  it('clamps tampered numeric fields', () => {
    const json = JSON.stringify({
      cash: 'wat',
      lifetimeEarnings: 'ook wat',
      investors: -50,
      prestigeCount: -3,
      totalTaps: 1.9,
      boostRemainingMs: -1000,
      boostMultiplier: 0,
      buyAmount: 73,
      businesses: [{ id: 'friet', owned: -10, progress: 99, managed: 'yes', active: 1 }],
    });
    const s = deserializeState(json, 0)!;
    expect(s.cash.eq(D(0))).toBe(true); // unparseable -> 0, not NaN
    expect(s.lifetimeEarnings.eq(D(0))).toBe(true);
    expect(s.investors).toBe(0);
    expect(s.prestigeCount).toBe(0);
    expect(s.totalTaps).toBe(1);
    expect(s.boostRemainingMs).toBe(0);
    expect(s.boostMultiplier).toBeGreaterThanOrEqual(1);
    expect(s.buyAmount).toBe(1);
    expect(s.businesses[0].owned).toBe(0);
    expect(s.businesses[0].progress).toBeLessThan(1);
    expect(s.businesses[0].managed).toBe(false); // non-boolean -> default
    expect(s.businesses[0].active).toBe(false);
  });

  it('never lets a future timestamp mint offline earnings', () => {
    const json = JSON.stringify({ cash: '0', businesses: [], lastActiveAt: 9_999_999 });
    const s = deserializeState(json, 1_000)!;
    expect(s.lastActiveAt).toBe(1_000);
  });
});

describe('codec — streak and achievements', () => {
  it('round-trips them', () => {
    const state: GameState = {
      ...createInitialState(0),
      streakDays: 12,
      lastStreakDay: 20_400,
      unlocked: ['tap-100', 'prestige-1'],
    };
    const back = deserializeState(serializeState(state), 0)!;
    expect(back.streakDays).toBe(12);
    expect(back.lastStreakDay).toBe(20_400);
    expect(back.unlocked).toEqual(['tap-100', 'prestige-1']);
  });

  // The v1 → v2 migration in full: there isn't one. Missing fields land on the
  // fresh defaults, the same way an unknown business tier does.
  it('loads a v1 save, which has none of these fields', () => {
    const v1 = JSON.stringify({
      version: 1,
      cash: '5000',
      lifetimeEarnings: '5000',
      investors: 3,
      businesses: [{ id: 'friet', owned: 7, progress: 0.5, managed: true, active: false }],
      buyAmount: 10,
      boostRemainingMs: 0,
      boostMultiplier: 2,
      prestigeCount: 1,
      totalTaps: 42,
      startedAt: 0,
      lastActiveAt: 0,
    });

    const s = deserializeState(v1, 1_000)!;
    // The v1 data survives...
    expect(s.cash.eq(D(5000))).toBe(true);
    expect(s.totalTaps).toBe(42);
    expect(s.businesses[0].owned).toBe(7);
    // ...and the v2 fields start clean.
    expect(s.streakDays).toBe(0);
    expect(s.lastStreakDay).toBe(0);
    expect(s.unlocked).toEqual([]);
    expect(s.version).toBe(SAVE_VERSION);
  });

  it('drops achievement ids this build no longer defines', () => {
    const json = JSON.stringify({
      cash: '0',
      businesses: [],
      unlocked: ['tap-100', 'from-a-future-version', 'own-50'],
    });
    expect(deserializeState(json, 0)!.unlocked).toEqual(['tap-100', 'own-50']);
  });

  it('drops duplicates, so a tampered save cannot inflate the count', () => {
    const json = JSON.stringify({
      cash: '0',
      businesses: [],
      unlocked: ['tap-100', 'tap-100', 'tap-100'],
    });
    expect(deserializeState(json, 0)!.unlocked).toEqual(['tap-100']);
  });

  it('survives an unlocked field that is not an array at all', () => {
    const json = JSON.stringify({ cash: '0', businesses: [], unlocked: 'everything' });
    expect(deserializeState(json, 0)!.unlocked).toEqual([]);
  });

  it('clamps a negative streak', () => {
    const json = JSON.stringify({ cash: '0', businesses: [], streakDays: -5 });
    expect(deserializeState(json, 0)!.streakDays).toBeGreaterThanOrEqual(0);
  });
});

describe('codec — perks', () => {
  it('round-trips the whole tree', () => {
    const base = createInitialState(0);
    const state: GameState = {
      ...base,
      investors: 500,
      perks: { ...base.perks, profit: 12, tap: 3, offline: 2 },
    };

    const back = deserializeState(serializeState(state), 0)!;
    expect(back.investors).toBe(500);
    expect(back.perks.profit).toBe(12);
    expect(back.perks.tap).toBe(3);
    expect(back.perks.offline).toBe(2);
    expect(back.perks.golden).toBe(0);
  });

  // The v2 → v3 migration in full: a save written before the skill tree existed
  // keeps every investor it earned and arrives with all of them unspent.
  it('gives a pre-skill-tree save an empty tree and its investors back', () => {
    const v2 = JSON.stringify({
      version: 2,
      cash: '5000',
      lifetimeEarnings: '9e11',
      investors: 470,
      businesses: [{ id: 'friet', owned: 7, progress: 0, managed: true, active: false }],
      streakDays: 4,
      unlocked: ['tap-100'],
      startedAt: 0,
      lastActiveAt: 0,
    });

    const s = deserializeState(v2, 1_000)!;
    expect(s.investors).toBe(470);
    expect(totalPerkLevels(s)).toBe(0);
    expect(availableInvestors(s)).toBe(470);
    expect(s.version).toBe(SAVE_VERSION);
  });

  it('clamps a capped perk to its maximum, whatever the save claims', () => {
    const json = JSON.stringify({
      cash: '0',
      businesses: [],
      perks: { tap: 999_999, cost: -40 },
    });
    const s = deserializeState(json, 0)!;
    expect(s.perks.tap).toBe(getPerk('tap').maxLevel);
    expect(s.perks.cost).toBe(0);
  });

  it('ignores perk ids this build does not define', () => {
    const json = JSON.stringify({
      cash: '0',
      businesses: [],
      perks: { profit: 4, 'from-the-future': 900 },
    });
    const s = deserializeState(json, 0)!;
    expect(s.perks.profit).toBe(4);
    expect((s.perks as Record<string, number>)['from-the-future']).toBeUndefined();
  });

  it('survives a perks field that is not an object at all', () => {
    for (const perks of ['everything', 42, null, ['profit']]) {
      const json = JSON.stringify({ cash: '0', businesses: [], perks });
      expect(totalPerkLevels(deserializeState(json, 0)!)).toBe(0);
    }
  });
});

describe('MMKV round-trip', () => {
  it('reports no save before anything is written', () => {
    expect(hasSave()).toBe(false);
    expect(loadGame(0)).toBeNull();
  });

  it('saves and loads through the real MMKV API', () => {
    const state = playedState();
    saveGame(state);

    expect(hasSave()).toBe(true);
    const loaded = loadGame(10_000)!;
    expect(loaded.cash.eq(state.cash)).toBe(true);
    expect(loaded.businesses[0].owned).toBe(state.businesses[0].owned);
  });

  it('overwrites the previous save rather than accumulating keys', () => {
    saveGame({ ...createInitialState(0), cash: D(1) });
    saveGame({ ...createInitialState(0), cash: D(2) });
    expect(loadGame(0)!.cash.eq(D(2))).toBe(true);
  });

  it('clears the save', () => {
    saveGame(createInitialState(0));
    clearSave();
    expect(hasSave()).toBe(false);
    expect(loadGame(0)).toBeNull();
  });

});

/**
 * These re-import `../storage` against a controlled MMKV so the failure paths
 * inside loadGame/saveGame are exercised. The bundled Jest mock hands out a
 * fresh in-memory store per createMMKV() call rather than sharing by id, so the
 * module's own instance cannot be reached from outside.
 */
describe('MMKV failure paths', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    jest.resetModules();
    jest.dontMock('react-native-mmkv');
  });

  function storageWith(instance: Record<string, unknown>): typeof import('../storage') {
    jest.resetModules();
    jest.doMock('react-native-mmkv', () => ({
      createMMKV: () => ({
        set: () => {},
        getString: () => undefined,
        contains: () => false,
        remove: () => {},
        ...instance,
      }),
    }));
    return require('../storage');
  }

  it('starts a new game rather than throwing when the stored blob is corrupt', () => {
    const mod = storageWith({
      getString: () => '{ truncated',
      contains: () => true,
    });
    expect(mod.hasSave()).toBe(true);
    expect(mod.loadGame(0)).toBeNull();
  });

  it('returns null instead of crashing the launch when the read throws', () => {
    const mod = storageWith({
      getString: () => {
        throw new Error('mmkv exploded');
      },
    });
    expect(mod.loadGame(0)).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it('never lets a failed write take down the play session', () => {
    const mod = storageWith({
      set: () => {
        throw new Error('disk full');
      },
    });
    expect(() => mod.saveGame(createInitialState(0))).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });
});
