/**
 * Save codec: versioned, migratable, corruption-proof (spec §14).
 *
 * Rules:
 *  - Decimal fields are stored as strings; everything else plain JSON.
 *  - Deserializing NEVER throws. Corrupt input → null (caller starts fresh);
 *    odd input → clamped against `defaultState()`. A save is untrusted input.
 *  - Missing fields (added by a later version) fill from defaults — that IS
 *    the migration for purely-additive changes. Structural changes get an
 *    entry in `migrations`.
 */
import { BAL } from './balance';
import { clean, decFromString, decToString } from './numbers';
import { CURRENT_VERSION, defaultState } from './state';
import { TIER_COUNT } from './systems/dimensions';
import { GameOptions, GameState, NotationMode } from './types';

// ---------------------------------------------------------------------------
// On-disk shape
// ---------------------------------------------------------------------------

interface SavedDim {
  bought: number;
  amount: string;
}

interface SavedGame {
  version: number;
  savedAt: number;
  startedAt: number;
  timePlayed: number;
  spark: string;
  bestSparkRun: string;
  totalSpark: string;
  dims: SavedDim[];
  sparkUpgrades: Record<string, number>;
  dimBoosts: number;
  totalTaps: number;
  motes: string;
  motesEver: string;
  moteUpgrades: Record<string, number>;
  options: GameOptions;
}

// ---------------------------------------------------------------------------
// Migrations: version n -> n+1. Run in order on load.
// ---------------------------------------------------------------------------

const migrations: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {
  // v1 is the first version — nothing to migrate yet.
};

// ---------------------------------------------------------------------------
// Sanitizers
// ---------------------------------------------------------------------------

function num(value: unknown, fallback: number, min = -Infinity): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, n);
}

function int(value: unknown, fallback: number, min = 0): number {
  return Math.floor(num(value, fallback, min));
}

/** Keep only known upgrade ids, levels floored at 0 and clamped to maxLevel. */
function levelsOf(
  value: unknown,
  defs: readonly { id: string; maxLevel: number | null }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return out;
  const raw = value as Record<string, unknown>;
  for (const def of defs) {
    const level = int(raw[def.id], 0, 0);
    if (level <= 0) continue;
    out[def.id] = def.maxLevel === null ? level : Math.min(level, def.maxLevel);
  }
  return out;
}

function notationOf(value: unknown): NotationMode {
  return value === 'scientific' || value === 'engineering' || value === 'standard'
    ? value
    : 'standard';
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

// ---------------------------------------------------------------------------
// Codec
// ---------------------------------------------------------------------------

export function serializeState(state: GameState): string {
  const saved: SavedGame = {
    version: CURRENT_VERSION,
    savedAt: state.savedAt,
    startedAt: state.startedAt,
    timePlayed: state.timePlayed,
    spark: decToString(state.spark),
    bestSparkRun: decToString(state.bestSparkRun),
    totalSpark: decToString(state.totalSpark),
    dims: state.dims.map((d) => ({ bought: d.bought, amount: decToString(d.amount) })),
    sparkUpgrades: { ...state.sparkUpgrades },
    dimBoosts: state.dimBoosts,
    totalTaps: state.totalTaps,
    motes: decToString(state.motes),
    motesEver: decToString(state.motesEver),
    moteUpgrades: { ...state.moteUpgrades },
    options: { ...state.options },
  };
  return JSON.stringify(saved);
}

/**
 * Rebuild a GameState from a save document. Returns null when the input is
 * not usable at all; anything merely odd is clamped against a fresh state.
 */
export function deserializeState(json: string, now: number = Date.now()): GameState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

  let raw = parsed as Record<string, unknown>;

  // Run migrations from the save's version up to current.
  let version = int(raw.version, 0, 0);
  if (version > CURRENT_VERSION) return null; // a save from the future is unreadable
  while (version < CURRENT_VERSION) {
    const migrate = migrations[version];
    if (!migrate) break; // additive-only gap: default-filling below covers it
    raw = migrate(raw);
    version += 1;
  }

  const saved = raw as Partial<SavedGame>;
  if (typeof saved.spark !== 'string') return null;

  const fresh = defaultState(now);
  const dimBoosts = int(saved.dimBoosts, 0, 0);

  const savedDims = Array.isArray(saved.dims) ? saved.dims : [];
  const dims = fresh.dims.map((d, i) => {
    const s = savedDims[i];
    const unlocked = i < BAL.startingTiers + dimBoosts;
    if (!s || typeof s !== 'object') return { ...d, unlocked };
    return {
      bought: int((s as SavedDim).bought, 0, 0),
      amount: clean(decFromString((s as SavedDim).amount)),
      unlocked,
    };
  });
  // Extra saved tiers beyond TIER_COUNT are dropped by construction.
  if (dims.length !== TIER_COUNT) return null;

  const rawOptions =
    typeof saved.options === 'object' && saved.options !== null
      ? (saved.options as Partial<GameOptions>)
      : {};

  return {
    version: CURRENT_VERSION,
    savedAt: Math.min(num(saved.savedAt, now), now), // future clocks must not mint offline time
    startedAt: num(saved.startedAt, now),
    timePlayed: num(saved.timePlayed, 0, 0),

    spark: decFromString(saved.spark),
    bestSparkRun: decFromString(saved.bestSparkRun ?? '0'),
    totalSpark: decFromString(saved.totalSpark ?? '0'),
    dims,
    sparkUpgrades: levelsOf(saved.sparkUpgrades, BAL.sparkUpgrades),
    dimBoosts,
    totalTaps: int(saved.totalTaps, 0, 0),

    motes: decFromString(saved.motes ?? '0'),
    motesEver: decFromString(saved.motesEver ?? '0'),
    moteUpgrades: levelsOf(saved.moteUpgrades, BAL.motes.upgrades),

    options: {
      notation: notationOf(rawOptions.notation),
      reducedMotion: bool(rawOptions.reducedMotion, fresh.options.reducedMotion),
      confirmResets: bool(rawOptions.confirmResets, fresh.options.confirmResets),
    },
  };
}
