import {
  ACHIEVEMENTS,
  achievementProgress,
  getAchievement,
  isUnlocked,
  newlyUnlocked,
  unlockedCount,
} from '../achievements';
import { BUSINESSES } from '../businesses';
import { claimStreak, createInitialState, settleAchievements } from '../engine';
import { D } from '../numbers';
import type { AchievementId, GameState } from '../types';

function fresh(): GameState {
  return createInitialState(0);
}

function withOwned(count: number): GameState {
  const base = fresh();
  return {
    ...base,
    businesses: base.businesses.map((b) => (b.id === 'friet' ? { ...b, owned: count } : b)),
  };
}

function withManagers(count: number): GameState {
  const base = fresh();
  return {
    ...base,
    businesses: base.businesses.map((b, i) => ({ ...b, managed: i < count })),
  };
}

describe('definitions', () => {
  it('has no duplicate ids', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every achievement a positive goal', () => {
    for (const def of ACHIEVEMENTS) {
      expect(def.goal).toBeGreaterThan(0);
    }
  });

  it('reads zero progress on a brand-new save', () => {
    const state = fresh();
    for (const def of ACHIEVEMENTS) {
      // The starting Fry Shack is the one thing already owned.
      if (def.id === 'own-50' || def.id === 'own-250' || def.id === 'own-1000') continue;
      expect(def.progress(state)).toBe(0);
    }
  });

  it('scales the all-managers goal with the roster, not a hard-coded ten', () => {
    expect(getAchievement('managers-all').goal).toBe(BUSINESSES.length);
  });

  it('throws on an unknown id rather than returning undefined', () => {
    expect(() => getAchievement('nope' as AchievementId)).toThrow();
  });
});

describe('achievementProgress', () => {
  it('is a fraction between zero and one', () => {
    expect(achievementProgress(withOwned(1), 'own-50')).toBeCloseTo(1 / 50);
    expect(achievementProgress(withOwned(25), 'own-50')).toBeCloseTo(0.5);
  });

  it('clamps past the goal instead of overflowing the bar', () => {
    expect(achievementProgress(withOwned(5_000), 'own-50')).toBe(1);
  });

  // lifetimeEarnings outgrows Number within a session; the bar must still fill.
  it('handles a lifetime far beyond Number.MAX_SAFE_INTEGER', () => {
    const state = { ...fresh(), lifetimeEarnings: D('1e40') };
    expect(achievementProgress(state, 'earn-1t')).toBe(1);
  });
});

describe('newlyUnlocked', () => {
  it('returns nothing for a fresh save', () => {
    expect(newlyUnlocked(fresh())).toHaveLength(0);
  });

  it('returns the same empty array every time, so ticks allocate nothing', () => {
    expect(newlyUnlocked(fresh())).toBe(newlyUnlocked(fresh()));
  });

  it('finds a crossed threshold', () => {
    expect(newlyUnlocked({ ...fresh(), totalTaps: 100 })).toContain('tap-100');
  });

  it('finds every tier crossed at once', () => {
    const found = newlyUnlocked({ ...fresh(), totalTaps: 10_000 });
    expect(found).toEqual(expect.arrayContaining(['tap-100', 'tap-1k', 'tap-10k']));
  });

  it('ignores ones already banked', () => {
    const state = { ...fresh(), totalTaps: 100, unlocked: ['tap-100' as AchievementId] };
    expect(newlyUnlocked(state)).not.toContain('tap-100');
  });

  it('unlocks on reaching the goal exactly, not one past it', () => {
    expect(newlyUnlocked({ ...fresh(), prestigeCount: 1 })).toContain('prestige-1');
    expect(newlyUnlocked({ ...fresh(), prestigeCount: 0 })).not.toContain('prestige-1');
  });

  it('tracks managers hired', () => {
    expect(newlyUnlocked(withManagers(5))).toContain('managers-5');
    expect(newlyUnlocked(withManagers(5))).not.toContain('managers-all');
    expect(newlyUnlocked(withManagers(BUSINESSES.length))).toContain('managers-all');
  });
});

describe('settleAchievements', () => {
  it('returns the SAME state object when nothing unlocked', () => {
    const state = fresh();
    const settled = settleAchievements(state);
    expect(settled.state).toBe(state);
    expect(settled.unlocked).toHaveLength(0);
  });

  it('banks the unlock', () => {
    const settled = settleAchievements({ ...fresh(), totalTaps: 100 });
    expect(isUnlocked(settled.state, 'tap-100')).toBe(true);
    expect(unlockedCount(settled.state)).toBe(1);
  });

  it('never awards the same one twice', () => {
    const once = settleAchievements({ ...fresh(), totalTaps: 100 });
    const twice = settleAchievements(once.state);
    expect(twice.state).toBe(once.state);
    expect(unlockedCount(once.state)).toBe(1);
  });

  it('does not mutate the input', () => {
    const state = { ...fresh(), totalTaps: 100 };
    settleAchievements(state);
    expect(state.unlocked).toHaveLength(0);
  });

  it('picks up a streak achievement earned by claiming', () => {
    // Three consecutive days, then settle.
    let state = fresh();
    for (const day of [14, 15, 16]) {
      state = claimStreak(state, new Date(2026, 2, day, 12).getTime()).state;
    }
    expect(settleAchievements(state).unlocked).toContain('streak-3');
  });
});
