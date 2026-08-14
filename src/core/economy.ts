/**
 * Pure economy math: costs, milestones, multipliers, revenue, prestige.
 *
 * Every function here is a pure function of its arguments — no mutation, no
 * time source, no randomness. This is the layer the unit tests pin down.
 *
 * PURE MODULE — no React, no React Native, no services.
 */
import { D, Decimal, ONE, ZERO } from './numbers';
import {
  BUSINESSES,
  COST_MULTIPLIER,
  INVESTOR_BONUS,
  MILESTONES,
  OFFLINE_CAP_SECONDS,
  PRESTIGE_DIVISOR,
  PRESTIGE_FACTOR,
  getDef,
  getIndex,
} from './businesses';
import type { BusinessDef, BusinessId, BusinessState, BuyAmount, GameState } from './types';

const LN_COST_MULTIPLIER = Math.log(COST_MULTIPLIER);

// ---------------------------------------------------------------------------
// Costs
// ---------------------------------------------------------------------------

/** Cost of the next single unit: baseCost * 1.10^owned. */
export function costOfNext(def: BusinessDef, owned: number): Decimal {
  return def.baseCost.mul(Decimal.pow(COST_MULTIPLIER, owned));
}

/**
 * Cost of buying `count` units starting from `owned` — the geometric sum
 * baseCost * 1.10^owned * (1.10^count - 1) / (1.10 - 1).
 */
export function buyCost(def: BusinessDef, owned: number, count: number): Decimal {
  if (count <= 0) return ZERO;
  const first = costOfNext(def, owned);
  const growth = Decimal.pow(COST_MULTIPLIER, count).sub(ONE);
  return first.mul(growth).div(COST_MULTIPLIER - 1);
}

/**
 * Largest number of units affordable with `cash`, computed analytically
 * (no loop over units):
 *
 *   k = floor( ln( cash * 0.10 / first + 1 ) / ln(1.10) )
 *
 * The closed form can land one off because of floating-point error in `ln`, so
 * the result is verified against `buyCost` and nudged. Guarantees:
 *   - buyCost(k)     <= cash   (never over-spends)
 *   - buyCost(k + 1) >  cash   (largest affordable)
 */
export function maxBuy(def: BusinessDef, owned: number, cash: Decimal): number {
  if (cash.lte(ZERO)) return 0;
  const first = costOfNext(def, owned);
  if (cash.lt(first)) return 0;

  const ratio = cash.mul(COST_MULTIPLIER - 1).div(first).add(ONE);
  let k = Math.floor(ratio.ln() / LN_COST_MULTIPLIER);
  if (!Number.isFinite(k) || k < 1) k = 1;

  // Correct floating-point drift. Both loops move at most a step or two.
  let guard = 64;
  while (k > 0 && buyCost(def, owned, k).gt(cash) && guard-- > 0) k -= 1;
  guard = 64;
  while (buyCost(def, owned, k + 1).lte(cash) && guard-- > 0) k += 1;

  return Math.max(0, k);
}

/** Resolve the ×1/×10/×100/MAX toggle into a concrete unit count. */
export function resolveBuyCount(state: GameState, id: BusinessId, amount?: BuyAmount): number {
  const buyAmount = amount ?? state.buyAmount;
  const def = getDef(id);
  const bs = getBusiness(state, id);
  if (buyAmount === 'MAX') return maxBuy(def, bs.owned, state.cash);
  return buyAmount;
}

/** Cost of the current buy-toggle selection for a business. */
export function costForAmount(state: GameState, id: BusinessId, amount?: BuyAmount): Decimal {
  const count = resolveBuyCount(state, id, amount);
  return buyCost(getDef(id), getBusiness(state, id).owned, count);
}

/** Can the player afford the current buy-toggle selection? MAX of 0 is never affordable. */
export function canAfford(state: GameState, id: BusinessId, amount?: BuyAmount): boolean {
  const count = resolveBuyCount(state, id, amount);
  if (count <= 0) return false;
  return state.cash.gte(buyCost(getDef(id), getBusiness(state, id).owned, count));
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

/** How many milestone thresholds the owned count has passed. */
export function milestoneCount(owned: number): number {
  let count = 0;
  for (const threshold of MILESTONES) {
    if (owned >= threshold) count += 1;
    else break;
  }
  return count;
}

/** Milestone multiplier for a business: 2^(milestones reached). */
export function milestoneMult(owned: number): number {
  return Math.pow(2, milestoneCount(owned));
}

/** Next milestone threshold, or null once all are passed. */
export function nextMilestone(owned: number): number | null {
  for (const threshold of MILESTONES) {
    if (owned < threshold) return threshold;
  }
  return null;
}

/** Units still needed for the next ×2, or null once all milestones are passed. */
export function unitsToNextMilestone(owned: number): number | null {
  const next = nextMilestone(owned);
  return next === null ? null : next - owned;
}

// ---------------------------------------------------------------------------
// Multipliers
// ---------------------------------------------------------------------------

/** Is the temporary profit boost running? */
export function isBoostActive(state: GameState): boolean {
  return state.boostRemainingMs > 0;
}

/** Permanent prestige multiplier: 1 + investors * 2%. */
export function investorMultiplier(investors: number): number {
  return 1 + investors * INVESTOR_BONUS;
}

/** Everything that scales all businesses at once: investors × active boost. */
export function globalMultiplier(state: GameState): number {
  const boost = isBoostActive(state) ? state.boostMultiplier : 1;
  return investorMultiplier(state.investors) * boost;
}

// ---------------------------------------------------------------------------
// Revenue
// ---------------------------------------------------------------------------

/**
 * Revenue of one full cycle:
 *   baseRevenue * owned * milestoneMult(owned) * globalMult
 *
 * `globalMult` is passed in so a tick can compute it once for all businesses.
 */
export function cycleRevenueFor(def: BusinessDef, owned: number, globalMult: number): Decimal {
  if (owned <= 0) return ZERO;
  return def.baseRevenue.mul(owned).mul(milestoneMult(owned)).mul(globalMult);
}

/** Revenue of one full cycle of a business in the current state. */
export function cycleRevenue(state: GameState, id: BusinessId): Decimal {
  const bs = getBusiness(state, id);
  return cycleRevenueFor(getDef(id), bs.owned, globalMultiplier(state));
}

/** A single business's income rate, ignoring whether it is automated. */
export function businessPerSecond(state: GameState, id: BusinessId): Decimal {
  const def = getDef(id);
  return cycleRevenue(state, id).div(def.cycleTime);
}

/**
 * Total passive income per second — managed businesses only, since anything
 * un-automated needs a tap and therefore earns nothing on its own.
 */
export function perSecond(state: GameState): Decimal {
  const globalMult = globalMultiplier(state);
  let total = ZERO;
  for (let i = 0; i < state.businesses.length; i += 1) {
    const bs = state.businesses[i];
    const def = BUSINESSES[i];
    if (!bs.managed || bs.owned <= 0) continue;
    total = total.add(cycleRevenueFor(def, bs.owned, globalMult).div(def.cycleTime));
  }
  return total;
}

// ---------------------------------------------------------------------------
// Prestige
// ---------------------------------------------------------------------------

/**
 * Total investors a given lifetime-earnings figure is worth:
 * floor(150 * sqrt(lifetime / 1e9)). First investor at ~€44.4k lifetime.
 */
export function investorsForLifetime(lifetimeEarnings: Decimal): number {
  if (lifetimeEarnings.lte(ZERO)) return 0;
  const total = lifetimeEarnings.div(PRESTIGE_DIVISOR).sqrt().mul(PRESTIGE_FACTOR).floor().toNumber();
  return Number.isFinite(total) ? Math.max(0, total) : 0;
}

/**
 * Investors gained by prestiging right now.
 *
 * `lifetimeEarnings` accumulates across runs and is never reset, so the payout
 * is (investors the total lifetime is worth) − (investors already banked).
 * That keeps the spec formula intact while making repeated prestiges
 * non-exploitable.
 */
export function prestigeGain(state: GameState): number {
  return Math.max(0, investorsForLifetime(state.lifetimeEarnings) - state.investors);
}

/** Prestige is offered once it would grant at least one investor. */
export function canPrestige(state: GameState): boolean {
  return prestigeGain(state) >= 1;
}

/** Lifetime earnings required for the next investor (for a progress hint). */
export function lifetimeForInvestors(investors: number): Decimal {
  const root = investors / PRESTIGE_FACTOR;
  return D(PRESTIGE_DIVISOR).mul(root * root);
}

// ---------------------------------------------------------------------------
// Offline
// ---------------------------------------------------------------------------

/** Elapsed seconds after the 12h cap. */
export function cappedOfflineSeconds(elapsedSeconds: number): number {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return 0;
  return Math.min(elapsedSeconds, OFFLINE_CAP_SECONDS);
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/** Business state by id. Throws on an unknown id — always a bug. */
export function getBusiness(state: GameState, id: BusinessId): BusinessState {
  const bs = state.businesses[getIndex(id)];
  if (!bs) throw new Error(`Business ${id} missing from state`);
  return bs;
}
