/**
 * Investor perks — the prestige skill tree.
 *
 * BALANCING LIVES HERE, like businesses.ts and achievements.ts: every number a
 * designer would want to turn is a field in `PERKS`, and nothing else needs
 * touching to retune the tree.
 *
 * WHY THIS EXISTS
 * ---------------
 * Investors used to grant a flat +2% profit each and nothing more. That is a
 * number that goes up by itself, so prestige read as "the same run again, a bit
 * faster" — no decision, no destination. Here investors are a currency you
 * *spend*, and two of the nodes have no maximum level, so there is always
 * something left to buy.
 *
 * THE ENDLESS-GROWTH CONDITION
 * ----------------------------
 * `profit` is the node that has to keep the game alive forever, and whether it
 * does is decided by two constants rather than by good intentions.
 *
 * Investors scale with the square root of lifetime earnings (`economy.ts`), and
 * lifetime earnings scale with the profit multiplier. So after a prestige the
 * player can afford levels up to `cost^n ≈ √P`, which buys `P' = power^n`.
 * Writing `P' = P^k`, that exponent is
 *
 *     k = ln(power) / (2 * ln(cost))
 *
 * and every run is stronger than the last only while `k > 1` — that is, while
 *
 *     power >= cost^2
 *
 * With power 1.20 and cost 1.09 we get 1.09² = 1.1881 <= 1.20, so k ≈ 1.05:
 * each prestige compounds on the last, gently and without end. Raise the cost
 * growth past ~1.095 and the curve silently converges to a ceiling instead —
 * the exact failure this whole file was written to remove. `perks.test.ts`
 * asserts the inequality so a future retune cannot break it by accident.
 *
 * PURE MODULE — no React, no React Native, no services.
 */
import { OFFLINE_CAP_SECONDS, GOLDEN_DURATION_MS, GOLDEN_MULTIPLIER } from './businesses';
import type { GameState, PerkDef, PerkId, PerkLevels } from './types';

// ---------------------------------------------------------------------------
// Effect sizes — the "step" of one level, per perk
// ---------------------------------------------------------------------------

/** `profit`: global profit is multiplied by this per level. Compounds. */
export const PERK_PROFIT_STEP = 1.2;
/** `payout`: investors earned per prestige, +10% per level. Additive. */
export const PERK_PAYOUT_STEP = 0.1;
/** `cost`: unit prices multiplied by (1 - step) per level. Compounds. */
export const PERK_COST_STEP = 0.03;
/** `manager`: manager prices multiplied by (1 - step) per level. Compounds. */
export const PERK_MANAGER_STEP = 0.08;
/** `offline`: seconds added to the offline cap per level. */
export const PERK_OFFLINE_STEP = 2 * 3600;
/** `tap`: extra cycles paid per manual tap, per level. */
export const PERK_TAP_STEP = 1;
/** `golden`: added to the golden frietzak multiplier per level. */
export const PERK_GOLDEN_STEP = 1;
/** `golden`: milliseconds added to the golden frietzak duration per level. */
export const PERK_GOLDEN_DURATION_STEP = 3_000;

/**
 * The tree.
 *
 * `maxLevel: null` is the endless kind. Everything with a cap has one for a
 * reason: a discount that reached 100% would make units free, and an offline
 * cap without a top would turn the game into a spreadsheet you open weekly.
 * Only the two nodes that can grow forever without breaking a rule do.
 */
export const PERKS: readonly PerkDef[] = [
  // Endless. The backbone: see the growth condition at the top of the file.
  { id: 'profit', icon: '💰', baseCost: 1, costGrowth: 1.09, maxLevel: null, step: PERK_PROFIT_STEP },
  // Endless, but linear in effect and exponential in price, so it supports the
  // curve rather than driving it: it makes each *run* pay out more investors.
  { id: 'payout', icon: '💼', baseCost: 5, costGrowth: 1.25, maxLevel: null, step: PERK_PAYOUT_STEP },

  // Capped: at 25 levels units cost ×0.47, which is a real shortcut and not a
  // free economy.
  { id: 'cost', icon: '🏷️', baseCost: 3, costGrowth: 1.35, maxLevel: 25, step: PERK_COST_STEP },
  // Capped: at 20 levels managers cost ×0.19 — early automation, still a cost.
  { id: 'manager', icon: '👔', baseCost: 2, costGrowth: 1.3, maxLevel: 20, step: PERK_MANAGER_STEP },
  // Capped at 12 levels: 12h base + 24h = a day and a half away, no more.
  { id: 'offline', icon: '🌙', baseCost: 4, costGrowth: 1.45, maxLevel: 12, step: PERK_OFFLINE_STEP },
  // Capped at 10: tapping pays 11 cycles at once. Gives the tap a job again
  // long after every tier is automated.
  { id: 'tap', icon: '👆', baseCost: 2, costGrowth: 1.5, maxLevel: 10, step: PERK_TAP_STEP },
  // Capped at 10: golden frietzak ×17 for 60s.
  { id: 'golden', icon: '✨', baseCost: 6, costGrowth: 1.4, maxLevel: 10, step: PERK_GOLDEN_STEP },
];

const BY_ID = new Map<PerkId, PerkDef>(PERKS.map((p) => [p.id, p]));

export function getPerk(id: PerkId): PerkDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Unknown perk: ${id}`);
  return def;
}

/** A fresh, empty tree. Every perk starts at level 0. */
export function freshPerks(): PerkLevels {
  return PERKS.reduce((acc, def) => {
    acc[def.id] = 0;
    return acc;
  }, {} as PerkLevels);
}

// ---------------------------------------------------------------------------
// Levels and cost
// ---------------------------------------------------------------------------

/** Level of a perk. Tolerates a save that predates the perk entirely. */
export function perkLevel(state: GameState, id: PerkId): number {
  const level = state.perks?.[id];
  return typeof level === 'number' && Number.isFinite(level) && level > 0 ? Math.floor(level) : 0;
}

/** True once a capped perk has nothing left to buy. Endless perks never do. */
export function isMaxed(def: PerkDef, level: number): boolean {
  return def.maxLevel !== null && level >= def.maxLevel;
}

/**
 * Investors to go from `level` to `level + 1`, or null when the perk is maxed.
 *
 * Rounded to a whole investor, and never below 1 — the first handful of `profit`
 * levels would otherwise all round to the same price anyway, which is a
 * deliberately soft on-ramp for a player's first prestige.
 */
export function perkCost(id: PerkId, level: number): number | null {
  const def = getPerk(id);
  if (isMaxed(def, level)) return null;
  const raw = def.baseCost * Math.pow(def.costGrowth, level);
  if (!Number.isFinite(raw)) return null;
  return Math.max(1, Math.round(raw));
}

/** Cost of the next level of a perk in the current state. */
export function nextPerkCost(state: GameState, id: PerkId): number | null {
  return perkCost(id, perkLevel(state, id));
}

/**
 * Total investors sunk into a perk to reach `level`.
 *
 * Memoised: this is summed for all seven perks on every render that shows the
 * investor balance, and an endless perk's level runs into the hundreds late in
 * the game. The function is pure, so the cache can never go stale.
 */
const totalCostCache = new Map<string, number>();

export function totalPerkCost(id: PerkId, level: number): number {
  if (level <= 0) return 0;
  const key = `${id}:${level}`;
  const hit = totalCostCache.get(key);
  if (hit !== undefined) return hit;

  let total = 0;
  for (let i = 0; i < level; i += 1) {
    const cost = perkCost(id, i);
    if (cost === null) break;
    total += cost;
  }
  totalCostCache.set(key, total);
  return total;
}

/** Investors already committed to the tree. */
export function spentInvestors(state: GameState): number {
  let spent = 0;
  for (const def of PERKS) {
    spent += totalPerkCost(def.id, perkLevel(state, def.id));
  }
  return spent;
}

/** Investors still free to spend. Never negative, even on a tampered save. */
export function availableInvestors(state: GameState): number {
  return Math.max(0, state.investors - spentInvestors(state));
}

/** Can the player afford the next level of this perk right now? */
export function canBuyPerk(state: GameState, id: PerkId): boolean {
  const cost = nextPerkCost(state, id);
  if (cost === null) return false;
  return availableInvestors(state) >= cost;
}

/** Total levels bought across the whole tree — the achievement metric. */
export function totalPerkLevels(state: GameState): number {
  return PERKS.reduce((sum, def) => sum + perkLevel(state, def.id), 0);
}

// ---------------------------------------------------------------------------
// Effects
//
// Each of these is the ONE place its perk is applied. Callers in economy.ts and
// engine.ts read these helpers rather than reaching into `state.perks`, so
// retuning a step never means hunting down call sites.
// ---------------------------------------------------------------------------

/** Permanent global profit multiplier from the tree: 1.2^level. */
export function perkProfitMultiplier(state: GameState): number {
  return Math.pow(PERK_PROFIT_STEP, perkLevel(state, 'profit'));
}

/** Multiplier on investors granted by a prestige: 1 + 10% per level. */
export function perkPayoutMultiplier(state: GameState): number {
  return 1 + perkLevel(state, 'payout') * PERK_PAYOUT_STEP;
}

/** Discount factor on unit prices: 0.97^level. */
export function perkUnitCostMultiplier(state: GameState): number {
  return Math.pow(1 - PERK_COST_STEP, perkLevel(state, 'cost'));
}

/** Discount factor on manager prices: 0.92^level. */
export function perkManagerCostMultiplier(state: GameState): number {
  return Math.pow(1 - PERK_MANAGER_STEP, perkLevel(state, 'manager'));
}

/** Offline cap in seconds, base plus 2h per level. */
export function perkOfflineCapSeconds(state: GameState): number {
  return OFFLINE_CAP_SECONDS + perkLevel(state, 'offline') * PERK_OFFLINE_STEP;
}

/** Cycles paid by one manual tap: 1, plus one per level. */
export function perkTapCycles(state: GameState): number {
  return 1 + perkLevel(state, 'tap') * PERK_TAP_STEP;
}

/** Golden frietzak multiplier, base plus one per level. */
export function perkGoldenMultiplier(state: GameState): number {
  return GOLDEN_MULTIPLIER + perkLevel(state, 'golden') * PERK_GOLDEN_STEP;
}

/** Golden frietzak duration in ms, base plus 3s per level. */
export function perkGoldenDurationMs(state: GameState): number {
  return GOLDEN_DURATION_MS + perkLevel(state, 'golden') * PERK_GOLDEN_DURATION_STEP;
}

/**
 * The perk's effect at its current level, as one bare number for display.
 *
 * Each perk reports it in the unit the player thinks in — a multiplier for
 * `profit`, a *fraction saved* for the two discounts, hours for `offline` — and
 * `ui/i18n` decides how to write that unit down. Level 0 always reports the
 * neutral value, so the row reads sensibly before anything is bought.
 */
export function perkEffectValue(state: GameState, id: PerkId): number {
  switch (id) {
    case 'profit':
      return perkProfitMultiplier(state);
    case 'payout':
      return perkPayoutMultiplier(state) - 1;
    case 'cost':
      return 1 - perkUnitCostMultiplier(state);
    case 'manager':
      return 1 - perkManagerCostMultiplier(state);
    case 'offline':
      return perkOfflineCapSeconds(state) / 3600;
    case 'tap':
      return perkTapCycles(state);
    case 'golden':
      return perkGoldenMultiplier(state);
  }
}
