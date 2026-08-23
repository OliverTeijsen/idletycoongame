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
import { AUTOMATION_IDS } from './systems/automation';
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
  shards: string;
  bestShards: string;
  shardsEver: string;
  collapses: number;
  shardUpgrades: Record<string, number>;
  starChart: Record<string, boolean>;
  automation: Record<string, boolean>;
  prism: string;
  bestPrism: string;
  prismEver: string;
  ascends: number;
  prismGrid: Record<string, number>;
  elements: { points: number; alloc: Record<string, number>; progress: number };
  challenges: Record<string, number>;
  activeChallenge: string | null;
  aeon: string;
  bestAeon: string;
  aeonEver: string;
  converges: number;
  aeonTree: Record<string, boolean>;
  ore: string;
  miners: Record<string, number>;
  research: Record<string, boolean>;
  flux: string;
  warpRemaining: number;
  boostRemaining: number;
  boostSlots: string[];
  options: GameOptions;
}

// ---------------------------------------------------------------------------
// Migrations: version n -> n+1. Run in order on load.
// ---------------------------------------------------------------------------

const migrations: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {
  // v1→v2 (Phase 3), v2→v3 (Phase 4) and v3→v4 (Phase 5) added only new
  // fields; default-filling below IS the migration for additive changes.
  1: (old) => old,
  2: (old) => old,
  3: (old) => old,
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

/** Keep only known ids mapped to true. */
function activeSetOf(value: unknown, knownIds: Set<string>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return out;
  for (const [id, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === true && knownIds.has(id)) out[id] = true;
  }
  return out;
}

/** Keep only known ids with an explicit boolean (toggles: missing = default). */
function togglesOf(value: unknown, knownIds: Set<string>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return out;
  for (const [id, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'boolean' && knownIds.has(id)) out[id] = v;
  }
  return out;
}

const KNOWN_STAR_NODES = new Set(BAL.starChart.map((n) => n.id));
const KNOWN_AUTOMATION = new Set(AUTOMATION_IDS as readonly string[]);
const KNOWN_CHALLENGES = new Set(BAL.challenges.defs.map((c) => c.id));
const KNOWN_ELEMENTS = new Set(BAL.elements.defs.map((e) => e.id));
const KNOWN_AEON_NODES = new Set(BAL.aeonTree.map((n) => n.id));
const KNOWN_RESEARCH = new Set(BAL.research.map((r) => r.id));
const KNOWN_MINERS = BAL.miners.map((m) => ({ id: m.id, maxLevel: null as number | null }));
const KNOWN_MANAGERS = new Set(BAL.managers.defs.map((m) => m.id));

/** Assigned managers: known ids, de-duplicated, capped at the possible max. */
function slotsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry === 'string' && KNOWN_MANAGERS.has(entry)) seen.add(entry);
  }
  return [...seen].slice(0, BAL.managers.defs.length);
}

/** Challenge completions: known ids, tiers clamped to each maxTier. */
function challengesOf(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return out;
  const raw = value as Record<string, unknown>;
  for (const def of BAL.challenges.defs) {
    const tiers = int(raw[def.id], 0, 0);
    if (tiers > 0) out[def.id] = Math.min(tiers, def.maxTier);
  }
  return out;
}

function elementsOf(value: unknown): { points: number; alloc: Record<string, number>; progress: number } {
  const fallback = { points: 0, alloc: {}, progress: 0 };
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return fallback;
  const raw = value as Record<string, unknown>;
  const alloc: Record<string, number> = {};
  if (typeof raw.alloc === 'object' && raw.alloc !== null && !Array.isArray(raw.alloc)) {
    for (const [id, v] of Object.entries(raw.alloc as Record<string, unknown>)) {
      const n = int(v, 0, 0);
      if (n > 0 && (KNOWN_ELEMENTS as Set<string>).has(id)) alloc[id] = n;
    }
  }
  return { points: int(raw.points, 0, 0), alloc, progress: num(raw.progress, 0, 0) };
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
    shards: decToString(state.shards),
    bestShards: decToString(state.bestShards),
    shardsEver: decToString(state.shardsEver),
    collapses: state.collapses,
    shardUpgrades: { ...state.shardUpgrades },
    starChart: { ...state.starChart },
    automation: { ...state.automation },
    prism: decToString(state.prism),
    bestPrism: decToString(state.bestPrism),
    prismEver: decToString(state.prismEver),
    ascends: state.ascends,
    prismGrid: { ...state.prismGrid },
    elements: { ...state.elements, alloc: { ...state.elements.alloc } },
    challenges: { ...state.challenges },
    activeChallenge: state.activeChallenge,
    aeon: decToString(state.aeon),
    bestAeon: decToString(state.bestAeon),
    aeonEver: decToString(state.aeonEver),
    converges: state.converges,
    aeonTree: { ...state.aeonTree },
    ore: decToString(state.ore),
    miners: { ...state.miners },
    research: { ...state.research },
    flux: decToString(state.flux),
    warpRemaining: state.warpRemaining,
    boostRemaining: state.boostRemaining,
    boostSlots: [...state.boostSlots],
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

    shards: decFromString(saved.shards ?? '0'),
    bestShards: decFromString(saved.bestShards ?? '0'),
    shardsEver: decFromString(saved.shardsEver ?? '0'),
    collapses: int(saved.collapses, 0, 0),
    shardUpgrades: levelsOf(saved.shardUpgrades, BAL.shardUpgrades),
    starChart: activeSetOf(saved.starChart, KNOWN_STAR_NODES),
    automation: togglesOf(saved.automation, KNOWN_AUTOMATION),
    autobuyTimer: 0,

    prism: decFromString(saved.prism ?? '0'),
    bestPrism: decFromString(saved.bestPrism ?? '0'),
    prismEver: decFromString(saved.prismEver ?? '0'),
    ascends: int(saved.ascends, 0, 0),
    prismGrid: levelsOf(saved.prismGrid, BAL.prismGrid),
    elements: elementsOf(saved.elements),
    challenges: challengesOf(saved.challenges),
    activeChallenge:
      typeof saved.activeChallenge === 'string' && KNOWN_CHALLENGES.has(saved.activeChallenge)
        ? saved.activeChallenge
        : null,

    aeon: decFromString(saved.aeon ?? '0'),
    bestAeon: decFromString(saved.bestAeon ?? '0'),
    aeonEver: decFromString(saved.aeonEver ?? '0'),
    converges: int(saved.converges, 0, 0),
    aeonTree: activeSetOf(saved.aeonTree, KNOWN_AEON_NODES),
    ore: decFromString(saved.ore ?? '0'),
    miners: levelsOf(saved.miners, KNOWN_MINERS),
    research: activeSetOf(saved.research, KNOWN_RESEARCH),
    flux: decFromString(saved.flux ?? '0'),
    // Timed boosts: clamp to their maximum plausible span so a tampered save
    // cannot smuggle in a year of warp.
    warpRemaining: Math.min(num(saved.warpRemaining, 0, 0), 86400),
    boostRemaining: Math.min(num(saved.boostRemaining, 0, 0), 86400),
    boostSlots: slotsOf(saved.boostSlots),

    options: {
      notation: notationOf(rawOptions.notation),
      reducedMotion: bool(rawOptions.reducedMotion, fresh.options.reducedMotion),
      confirmResets: bool(rawOptions.confirmResets, fresh.options.confirmResets),
    },
  };
}
