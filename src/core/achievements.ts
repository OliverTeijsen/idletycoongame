/**
 * Achievement definitions and the unlock check.
 *
 * BALANCING LIVES HERE, like businesses.ts: every threshold is a number in this
 * file, and nothing else needs touching to retune them.
 *
 * PURE MODULE — no React, no React Native, no services.
 */
import { BUSINESSES } from './businesses';
import { totalPerkLevels } from './perks';
import type { AchievementDef, AchievementId, GameState } from './types';

/** Total units owned across every tier. */
function totalOwned(state: GameState): number {
  return state.businesses.reduce((sum, bs) => sum + bs.owned, 0);
}

function totalManagers(state: GameState): number {
  return state.businesses.reduce((sum, bs) => sum + (bs.managed ? 1 : 0), 0);
}

/**
 * Lifetime earnings as a plain number, for the progress bar.
 *
 * `Decimal` outgrows `number` within a session, so this saturates at `Infinity`
 * instead of pretending to be exact. Only the ratio against `goal` is ever
 * shown, and past the goal the bar is full either way.
 */
function lifetimeAsNumber(state: GameState): number {
  return state.lifetimeEarnings.toNumber();
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'tap-100', icon: '👆', goal: 100, progress: (s) => s.totalTaps },
  { id: 'tap-1k', icon: '👆', goal: 1_000, progress: (s) => s.totalTaps },
  { id: 'tap-10k', icon: '💪', goal: 10_000, progress: (s) => s.totalTaps },

  { id: 'own-50', icon: '🏪', goal: 50, progress: totalOwned },
  { id: 'own-250', icon: '🏬', goal: 250, progress: totalOwned },
  { id: 'own-1000', icon: '🌍', goal: 1_000, progress: totalOwned },

  { id: 'managers-5', icon: '👔', goal: 5, progress: totalManagers },
  { id: 'managers-all', icon: '🎩', goal: BUSINESSES.length, progress: totalManagers },

  { id: 'earn-1m', icon: '💰', goal: 1e6, progress: lifetimeAsNumber },
  { id: 'earn-1t', icon: '🏦', goal: 1e12, progress: lifetimeAsNumber },

  { id: 'prestige-1', icon: '💼', goal: 1, progress: (s) => s.prestigeCount },
  { id: 'prestige-10', icon: '👑', goal: 10, progress: (s) => s.prestigeCount },

  { id: 'streak-3', icon: '📅', goal: 3, progress: (s) => s.streakDays },
  { id: 'streak-7', icon: '🔥', goal: 7, progress: (s) => s.streakDays },
  { id: 'streak-30', icon: '🏆', goal: 30, progress: (s) => s.streakDays },

  // The skill tree is the thing a returning player is most likely to miss, so
  // the first one fires the moment they spend a single investor.
  { id: 'perks-1', icon: '🌱', goal: 1, progress: totalPerkLevels },
  { id: 'perks-25', icon: '🧠', goal: 25, progress: totalPerkLevels },
];

const BY_ID = new Map<AchievementId, AchievementDef>(ACHIEVEMENTS.map((a) => [a.id, a]));

export function getAchievement(id: AchievementId): AchievementDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Unknown achievement: ${id}`);
  return def;
}

/** Progress toward an achievement, clamped to [0, 1]. */
export function achievementProgress(state: GameState, id: AchievementId): number {
  const def = getAchievement(id);
  if (def.goal <= 0) return 1;
  return Math.min(1, Math.max(0, def.progress(state) / def.goal));
}

export function isUnlocked(state: GameState, id: AchievementId): boolean {
  return state.unlocked.includes(id);
}

/**
 * Achievements newly earned by this state, in definition order.
 *
 * Returns a shared empty array when nothing changed — this runs on every tick,
 * and allocating a fresh array ten times a second to say "no" is waste the
 * store would then have to diff.
 */
const NONE: readonly AchievementId[] = [];

export function newlyUnlocked(state: GameState): readonly AchievementId[] {
  let found: AchievementId[] | null = null;
  for (const def of ACHIEVEMENTS) {
    if (state.unlocked.includes(def.id)) continue;
    if (def.progress(state) >= def.goal) {
      found ??= [];
      found.push(def.id);
    }
  }
  return found ?? NONE;
}

/** How many are earned, for the "7 / 15" headline. */
export function unlockedCount(state: GameState): number {
  return state.unlocked.length;
}
