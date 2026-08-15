/**
 * Business definitions + every economy constant.
 *
 * BALANCING LIVES HERE. These numbers are tunable, not sacred — changing the
 * curve should never require touching economy.ts or engine.ts.
 *
 * PURE MODULE — no React, no React Native, no services.
 */
import { D, Decimal } from './numbers';
import type { BusinessDef, BusinessId } from './types';

// ---------------------------------------------------------------------------
// Constants (spec §4)
// ---------------------------------------------------------------------------

/** Each owned unit makes the next one 10% more expensive. */
export const COST_MULTIPLIER = 1.1;

/**
 * Owned counts at which a business doubles its output.
 *
 * These are the hand-paced early ones. They do NOT stop at 1000 — see
 * `MILESTONE_STEP`, which continues the ladder forever.
 */
export const MILESTONES: readonly number[] = [25, 50, 100, 150, 200, 300, 400, 500, 750, 1000];

/**
 * Spacing of every milestone past the last listed one — forever.
 *
 * This is the single change that makes the game endless. With a finite ladder a
 * tier stops improving at 1000 owned: output then grows linearly with `owned`
 * while the next unit costs 1.1^owned, so progression hits a wall it can never
 * climb again and the whole game is over in a day. An unbounded ladder means
 * every tier always has a next ×2, and the run can keep going as long as the
 * player wants it to.
 *
 * `milestoneMult` returns a `Decimal` precisely because this has no top: 2^n
 * leaves the range of a JS number at n = 1024, which an endless ladder reaches.
 */
export const MILESTONE_STEP = 500;

/**
 * Owned counts at which a business **halves its cycle time**.
 *
 * This is what turns a tier from "automatic" into "constant": each threshold
 * doubles the rate, and once the cycle drops under the 100ms tick the bar stops
 * visibly cycling and reads as a continuous stream. A Fry Shack starts at 1.5s
 * and is under the tick by 300 owned.
 *
 * Every halving also doubles income, exactly like a profit milestone — these
 * thresholds are deliberately spaced wider than MILESTONES so the two curves do
 * not compound at the same moments.
 */
export const SPEED_MILESTONES: readonly number[] = [25, 100, 200, 300, 400];

/**
 * Floor on the effective cycle time. `advance()` is analytic and copes with any
 * value, but a cycle shorter than this buys nothing visually and only invites
 * floating-point silliness.
 */
export const MIN_CYCLE_SECONDS = 0.02;

/**
 * At or below this effective cycle time the UI stops animating discrete cycles
 * and shows a continuous bar — anything faster than the tick cannot be drawn
 * honestly as a filling bar anyway.
 */
export const CONTINUOUS_CYCLE_SECONDS = 0.12;

// ---------------------------------------------------------------------------
// Cash upgrades (per tier)
//
// The second endless track, and the one that gives cash a job. Milestones are
// bought with *units*, whose price runs away at 1.1^owned; between two units
// there is a long stretch where money piles up with nowhere to go. An upgrade
// is somewhere to put it, and because it is per tier it is also a choice.
// ---------------------------------------------------------------------------

/** Each upgrade level doubles that one tier's profit. No maximum level. */
export const UPGRADE_STEP = 2;

/** The first upgrade of a tier costs this many times its base unit price. */
export const UPGRADE_COST_FACTOR = 30;

/**
 * Price growth per upgrade level.
 *
 * Deliberately *above* `UPGRADE_STEP`: an upgrade track that outgrew its own
 * price would spiral on its own and flatten every other system. At 2.2 against
 * a ×2 payoff it slowly loses ground to itself, so the next level becomes
 * affordable through milestones and perks rather than through the upgrades
 * already bought — which is what keeps the three systems pulling together
 * instead of one of them running away with the game.
 */
export const UPGRADE_COST_GROWTH = 2.2;

/**
 * Base cap on offline earnings, before the `offline` perk extends it.
 *
 * Investors used to grant a flat +2% each. That is gone: it was a number that
 * went up on its own, which is exactly why prestige felt like it did nothing.
 * Every point of permanent power is now bought in the skill tree — see
 * `perks.ts`.
 */
export const OFFLINE_CAP_SECONDS = 12 * 3600;

/** Rewarded-ad profit boost. */
export const BOOST_DURATION_MS = 30_000;
export const BOOST_MULTIPLIER = 2;

/** Golden frietzak burst (spec §5) — same boost system, stronger multiplier. */
export const GOLDEN_MULTIPLIER = 7;
export const GOLDEN_DURATION_MS = 30_000;

/** Prestige: investors = floor(PRESTIGE_FACTOR * sqrt(lifetime / PRESTIGE_DIVISOR)). */
export const PRESTIGE_FACTOR = 150;
export const PRESTIGE_DIVISOR = 1e9;

/** The player starts with one Fry Shack so there is something to tap immediately. */
export const STARTING_BUSINESS: BusinessId = 'friet';
export const STARTING_OWNED = 1;

/**
 * Daily streak. The reward is a slice of the player's *current* income, so it
 * stays meaningful at every stage instead of becoming pocket change by tier 4.
 */
export const STREAK_MAX_DAYS = 7;
export const STREAK_SECONDS_PER_DAY = 300;
/**
 * Floor for the reward, so day one of a brand-new save is never literally €0.
 * Ten cycles of the starting business — trivial later, welcome at the start.
 */
export const STREAK_MIN_REWARD = 30;

/** Save schema version. Bump when the shape changes and add a migration. */
export const SAVE_VERSION = 4;

// ---------------------------------------------------------------------------
// Business tiers (spec §4)
// ---------------------------------------------------------------------------

interface RawBusinessDef {
  id: BusinessId;
  name: string;
  icon: string;
  baseCost: number;
  baseRevenue: number;
  cycleTime: number;
  managerCost: number;
}

// `name` is the canonical English label. It is NOT what the UI renders — the
// core cannot import the i18n layer (architecture rule), so display names live
// in `ui/i18n/*.ts`, keyed by id. This field is the fallback and the
// debug/log-friendly name; `i18n.test.ts` asserts `en` never drifts from it.
const RAW: readonly RawBusinessDef[] = [
  { id: 'friet',   name: 'Fry Shack',                icon: '🍟', baseCost: 4,              baseRevenue: 3,             cycleTime: 1.5, managerCost: 1e3 },
  { id: 'wafel',   name: 'Waffle Stand',             icon: '🧇', baseCost: 60,             baseRevenue: 60,            cycleTime: 3,   managerCost: 15e3 },
  { id: 'choco',   name: 'Chocolate Shop',           icon: '🍫', baseCost: 720,            baseRevenue: 540,           cycleTime: 6,   managerCost: 200e3 },
  { id: 'cafe',    name: 'Beer Café',                icon: '🍺', baseCost: 8_640,          baseRevenue: 4_320,         cycleTime: 12,  managerCost: 3.5e6 },
  { id: 'brouw',   name: 'Trappist Brewery',         icon: '🏭', baseCost: 103_680,        baseRevenue: 51_840,        cycleTime: 24,  managerCost: 50e6 },
  { id: 'resto',   name: 'Michelin-Star Restaurant', icon: '⭐', baseCost: 1_244_160,      baseRevenue: 622_080,       cycleTime: 48,  managerCost: 800e6 },
  // NOTE: baseRevenue below is the spec's literal value. The ×0.5-of-cost pattern
  // used by every other tier would give 7_464_960 — likely a typo in the spec,
  // kept verbatim until balancing says otherwise.
  { id: 'truck',   name: 'Food Truck Franchise',     icon: '🚚', baseCost: 14_929_920,     baseRevenue: 7_464_200,     cycleTime: 96,  managerCost: 12e9 },
  { id: 'super',   name: 'Supermarket Chain',        icon: '🏬', baseCost: 179_159_040,    baseRevenue: 89_579_520,    cycleTime: 192, managerCost: 180e9 },
  { id: 'concern', name: 'Food Conglomerate',        icon: '🏢', baseCost: 2_149_908_480,  baseRevenue: 1_074_954_240, cycleTime: 384, managerCost: 2.7e12 },
  { id: 'empire',  name: 'Global F&B Empire',        icon: '🌍', baseCost: 25_798_901_760, baseRevenue: 12_899_450_880, cycleTime: 768, managerCost: 40e12 },
];

/** The 10 business tiers, in display order. Index === tier index everywhere. */
export const BUSINESSES: readonly BusinessDef[] = RAW.map((r) => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  baseCost: D(r.baseCost),
  baseRevenue: D(r.baseRevenue),
  cycleTime: r.cycleTime,
  managerCost: D(r.managerCost),
}));

const BY_ID: Readonly<Record<BusinessId, BusinessDef>> = BUSINESSES.reduce(
  (acc, def) => {
    acc[def.id] = def;
    return acc;
  },
  {} as Record<BusinessId, BusinessDef>,
);

const INDEX_BY_ID: Readonly<Record<BusinessId, number>> = BUSINESSES.reduce(
  (acc, def, i) => {
    acc[def.id] = i;
    return acc;
  },
  {} as Record<BusinessId, number>,
);

/** Look up a definition. Throws on an unknown id — that is always a bug. */
export function getDef(id: BusinessId): BusinessDef {
  const def = BY_ID[id];
  if (!def) throw new Error(`Unknown business id: ${id}`);
  return def;
}

/** Index of a business in BUSINESSES / GameState.businesses. */
export function getIndex(id: BusinessId): number {
  const i = INDEX_BY_ID[id];
  if (i === undefined) throw new Error(`Unknown business id: ${id}`);
  return i;
}

/** Sanity guard so a Decimal never sneaks in as a number. */
export function assertDecimal(value: unknown, label: string): asserts value is Decimal {
  if (!(value instanceof Decimal)) {
    throw new Error(`${label} must be a Decimal, got ${typeof value}`);
  }
}
