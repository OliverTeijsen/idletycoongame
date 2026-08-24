import { BAL } from '../balance';
import { tick } from '../loop';
import { D, ONE, ZERO } from '../numbers';
import { deserializeState, serializeState } from '../save';
import { defaultState } from '../state';
import {
  ACHIEVEMENTS,
  achievementCount,
  achievementMult,
  achievementUnlocked,
  checkAchievements,
} from '../systems/achievements';
import { globalMult } from '../systems/multipliers';
import { doCollapse } from '../systems/prestige';

describe('definitions', () => {
  it('ids are unique and every one has a group and description', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    expect(ids.size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(50);
    for (const def of ACHIEVEMENTS) {
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.desc.length).toBeGreaterThan(0);
      expect(GROUPS).toContain(def.group);
    }
  });

  it('none fire on a brand-new save', () => {
    const s = defaultState(0);
    expect(checkAchievements(s)).toEqual([]);
    expect(achievementCount(s)).toBe(0);
  });

  it('every achievement is reachable — a maxed state earns them all', () => {
    const s = defaultState(0);
    s.bestSparkRun = D('1e200');
    s.totalSpark = D('1e200');
    s.dims = s.dims.map(() => ({ bought: 100, amount: D('1e20'), unlocked: true }));
    s.dimBoosts = 30;
    s.totalTaps = 10000;
    s.motes = D('1e30');
    s.motesEver = D('1e30');
    s.moteUpgrades = { focus: 20, resonance: 20 };
    s.collapses = 200;
    s.ascends = 20;
    s.converges = 10;
    s.unifies = 10;
    s.shards = D(1e6);
    s.prism = D(1e3);
    s.aeon = D(100);
    s.singularity = D(50);
    for (const node of BAL.starChart) s.starChart[node.id] = true;
    s.elements = { points: 5, alloc: { lux: 15 }, progress: 0 };
    for (const c of BAL.challenges.defs) s.challenges[c.id] = c.maxTier;
    s.miners = { drill: 5 };
    s.ore = D(1e6);
    for (const r of BAL.research) s.research[r.id] = true;
    s.boostSlots = ['kindler', 'weaver', 'warden'];
    s.flux = D(500);
    s.warpRemaining = 60;
    s.timePlayed = 200000;
    for (const m of BAL.metaShop) s.metaShop[m.id] = true;
    s.aeonTree = { autoCollapse: true };

    checkAchievements(s);
    const missing = ACHIEVEMENTS.filter((a) => !achievementUnlocked(s, a.id)).map((a) => a.id);
    expect(missing).toEqual([]);
  });
});

const GROUPS = ['spark', 'orbiters', 'motes', 'prestige', 'depths', 'mastery'];

describe('earning', () => {
  it('fires once, queues a toast, and is not re-earned', () => {
    const s = defaultState(0);
    s.dims[0].amount = D(1);
    const first = checkAchievements(s);
    expect(first).toContain('firstOrbiter');
    expect(s.pendingAchievements).toContain('firstOrbiter');
    expect(checkAchievements(s)).toEqual([]); // idempotent
  });

  it('the toast queue is capped so an offline catch-up cannot flood the UI', () => {
    const s = defaultState(0);
    s.bestSparkRun = D('1e200');
    s.dims[0].amount = D('1e15');
    s.totalTaps = 10000;
    checkAchievements(s);
    expect(s.pendingAchievements.length).toBeLessThanOrEqual(5);
  });

  it('the tick loop earns them during normal play', () => {
    const s = defaultState(0);
    s.dims[0].amount = D(100);
    tick(s, 1);
    expect(achievementCount(s)).toBeGreaterThan(0);
  });
});

describe('multiplier', () => {
  it('is 1 + 0.01 per earned achievement and reaches globalMult', () => {
    const s = defaultState(0);
    expect(achievementMult(s).eq(ONE)).toBe(true);
    s.achievements = { firstOrbiter: true, taps100: true, firstMote: true };
    expect(achievementMult(s).sub(D(1.03)).abs().lt(D(1e-9))).toBe(true);
    expect(globalMult(s).gte(D(1.03))).toBe(true);
  });
});

describe('persistence', () => {
  it('earned achievements survive a save roundtrip; unknown ids are dropped', () => {
    const s = defaultState(0);
    s.achievements = { firstOrbiter: true };
    const back = deserializeState(serializeState(s), 0)!;
    expect(back.achievements).toEqual({ firstOrbiter: true });
    expect(back.pendingAchievements).toEqual([]); // transient, never persisted

    const doc = JSON.parse(serializeState(s));
    doc.achievements = { firstOrbiter: true, hackedAchievement: true, taps100: 'yes' };
    const tampered = deserializeState(JSON.stringify(doc), 0)!;
    expect(tampered.achievements).toEqual({ firstOrbiter: true });
  });

  it('no reset clears them — not even Collapse', () => {
    const s = defaultState(0);
    s.achievements = { firstOrbiter: true, collapse1: true };
    s.bestSparkRun = D(1e8);
    doCollapse(s);
    expect(s.achievements.firstOrbiter).toBe(true);
    expect(s.achievements.collapse1).toBe(true);
  });
});
