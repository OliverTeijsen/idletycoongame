/**
 * Local persistence (MMKV).
 *
 * Design rules:
 *  - `Decimal` money fields are stored as strings; everything else is plain JSON.
 *  - Loading NEVER throws. A corrupt, truncated or future-version save starts a
 *    new game instead of crashing on launch — the worst possible bug in an idle
 *    game is one that bricks the app for a player with a big empire.
 *  - The save shape is a flat, id-keyed document so it can be POSTed to the
 *    Laravel cloud-save endpoint in v1.2 unchanged.
 */
import { createMMKV } from 'react-native-mmkv';

import { ACHIEVEMENTS } from '../core/achievements';
import { SAVE_VERSION } from '../core/businesses';
import { createInitialState } from '../core/engine';
import { decFromString, decToString } from '../core/numbers';
import type {
  AchievementId,
  BusinessId,
  BusinessState,
  BuyAmount,
  GameState,
} from '../core/types';

export const SAVE_KEY = 'save.v1';

export const STORAGE_ID = 'frietkot-imperium';

/**
 * react-native-mmkv v4 exposes a factory rather than a class, and returns an
 * in-memory instance automatically under Jest — which is why the persistence
 * tests exercise this file for real instead of a hand-written mock.
 */
const storage = createMMKV({ id: STORAGE_ID });

/** On-disk shape. Keep in sync with SAVE_VERSION + a migration when it changes. */
interface SavedBusiness {
  id: BusinessId;
  owned: number;
  progress: number;
  managed: boolean;
  active: boolean;
}

interface SavedGame {
  version: number;
  cash: string;
  lifetimeEarnings: string;
  investors: number;
  businesses: SavedBusiness[];
  buyAmount: BuyAmount;
  boostRemainingMs: number;
  boostMultiplier: number;
  prestigeCount: number;
  totalTaps: number;
  streakDays: number;
  lastStreakDay: number;
  unlocked: AchievementId[];
  startedAt: number;
  lastActiveAt: number;
}

// ---------------------------------------------------------------------------
// Sanitizers — a save file is untrusted input
// ---------------------------------------------------------------------------

function num(value: unknown, fallback: number, min = -Infinity): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, n);
}

function int(value: unknown, fallback: number, min = 0): number {
  return Math.floor(num(value, fallback, min));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function buyAmountOf(value: unknown): BuyAmount {
  return value === 1 || value === 10 || value === 100 || value === 'MAX' ? value : 1;
}

const KNOWN_ACHIEVEMENTS = new Set<string>(ACHIEVEMENTS.map((a) => a.id));

/**
 * Keep only ids this build still defines, without duplicates.
 *
 * A save can name an achievement that a later version renamed or dropped, and a
 * tampered one can name anything at all. Dropping the unknown entries is the
 * behaviour that survives both.
 */
function achievementsOf(value: unknown): AchievementId[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: AchievementId[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    if (!KNOWN_ACHIEVEMENTS.has(entry) || seen.has(entry)) continue;
    seen.add(entry);
    out.push(entry as AchievementId);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Codec
// ---------------------------------------------------------------------------

export function serializeState(state: GameState): string {
  const saved: SavedGame = {
    version: SAVE_VERSION,
    cash: decToString(state.cash),
    lifetimeEarnings: decToString(state.lifetimeEarnings),
    investors: state.investors,
    businesses: state.businesses.map((bs) => ({
      id: bs.id,
      owned: bs.owned,
      progress: bs.progress,
      managed: bs.managed,
      active: bs.active,
    })),
    buyAmount: state.buyAmount,
    boostRemainingMs: state.boostRemainingMs,
    boostMultiplier: state.boostMultiplier,
    prestigeCount: state.prestigeCount,
    totalTaps: state.totalTaps,
    streakDays: state.streakDays,
    lastStreakDay: state.lastStreakDay,
    unlocked: state.unlocked,
    startedAt: state.startedAt,
    lastActiveAt: state.lastActiveAt,
  };
  return JSON.stringify(saved);
}

/**
 * Rebuild a GameState from a save document. Returns null when the input is not
 * usable at all; anything merely *odd* is clamped against a fresh state.
 *
 * Businesses are merged BY ID onto a fresh roster, so adding a tier in a future
 * version (v1.3 regions) loads old saves without a migration. Whole *fields*
 * work the same way: a v1 save has no streak or achievements, and simply picks
 * up the fresh defaults.
 */
export function deserializeState(json: string, now: number = Date.now()): GameState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

  const saved = parsed as Partial<SavedGame>;
  if (typeof saved.cash !== 'string' || !Array.isArray(saved.businesses)) return null;

  const fresh = createInitialState(now);
  const byId = new Map<BusinessId, Partial<SavedBusiness>>();
  for (const entry of saved.businesses) {
    if (entry && typeof entry === 'object' && typeof entry.id === 'string') {
      byId.set(entry.id as BusinessId, entry);
    }
  }

  const businesses: BusinessState[] = fresh.businesses.map((bs) => {
    const s = byId.get(bs.id);
    if (!s) return bs;
    return {
      id: bs.id,
      owned: int(s.owned, bs.owned),
      // Progress is a fraction in [0, 1); anything else means a tampered save.
      progress: Math.min(0.999999, Math.max(0, num(s.progress, 0))),
      managed: bool(s.managed, false),
      active: bool(s.active, false),
    };
  });

  return {
    version: SAVE_VERSION,
    cash: decFromString(saved.cash),
    lifetimeEarnings: decFromString(saved.lifetimeEarnings ?? '0'),
    investors: int(saved.investors, 0),
    businesses,
    buyAmount: buyAmountOf(saved.buyAmount),
    boostRemainingMs: num(saved.boostRemainingMs, 0, 0),
    boostMultiplier: Math.max(1, num(saved.boostMultiplier, fresh.boostMultiplier)),
    prestigeCount: int(saved.prestigeCount, 0),
    totalTaps: int(saved.totalTaps, 0),
    // A v1 save has none of these three. They land on the fresh defaults, which
    // is the whole migration — same reason businesses merge by id.
    streakDays: int(saved.streakDays, fresh.streakDays),
    lastStreakDay: int(saved.lastStreakDay, fresh.lastStreakDay),
    unlocked: achievementsOf(saved.unlocked),
    startedAt: num(saved.startedAt, now),
    // A save from the future (clock change) must not mint offline earnings.
    lastActiveAt: Math.min(num(saved.lastActiveAt, now), now),
  };
}

// ---------------------------------------------------------------------------
// MMKV
// ---------------------------------------------------------------------------

export function saveGame(state: GameState): void {
  try {
    storage.set(SAVE_KEY, serializeState(state));
  } catch (error) {
    // Never let a failed write take down a play session.
    console.warn('[storage] save failed', error);
  }
}

/** Load the save, or null when there is none (or it is unreadable). */
export function loadGame(now: number = Date.now()): GameState | null {
  try {
    const json = storage.getString(SAVE_KEY);
    if (!json) return null;
    return deserializeState(json, now);
  } catch (error) {
    console.warn('[storage] load failed', error);
    return null;
  }
}

export function hasSave(): boolean {
  return storage.contains(SAVE_KEY);
}

export function clearSave(): void {
  storage.remove(SAVE_KEY);
}
