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
  CONTINUOUS_CYCLE_SECONDS,
  COST_MULTIPLIER,
  MILESTONES,
  MILESTONE_STEP,
  MIN_CYCLE_SECONDS,
  OFFLINE_CAP_SECONDS,
  PRESTIGE_DIVISOR,
  PRESTIGE_FACTOR,
  SPEED_MILESTONES,
  UPGRADE_COST_FACTOR,
  UPGRADE_COST_GROWTH,
  UPGRADE_STEP,
  getDef,
  getIndex,
} from './businesses';
import {
  perkManagerCostMultiplier,
  perkOfflineCapSeconds,
  perkPayoutMultiplier,
  perkProfitMultiplier,
  perkUnitCostMultiplier,
} from './perks';
import type { BusinessDef, BusinessId, BusinessState, BuyAmount, GameState } from './types';

const LN_COST_MULTIPLIER = Math.log(COST_MULTIPLIER);

// ---------------------------------------------------------------------------
// Costs
// ---------------------------------------------------------------------------

/**
 * Cost of the next single unit: baseCost * 1.10^owned * discount.
 *
 * `discount` is the `cost` perk's factor (1 = no perk). It is a parameter rather
 * than a state read because these three functions are the pure, testable core of
 * the cost curve; the state-aware wrappers further down pass it in.
 */
export function costOfNext(def: BusinessDef, owned: number, discount = 1): Decimal {
  return def.baseCost.mul(Decimal.pow(COST_MULTIPLIER, owned)).mul(discount);
}

/**
 * Cost of buying `count` units starting from `owned` — the geometric sum
 * baseCost * 1.10^owned * (1.10^count - 1) / (1.10 - 1), after the discount.
 */
export function buyCost(
  def: BusinessDef,
  owned: number,
  count: number,
  discount = 1,
): Decimal {
  if (count <= 0) return ZERO;
  const first = costOfNext(def, owned, discount);
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
export function maxBuy(
  def: BusinessDef,
  owned: number,
  cash: Decimal,
  discount = 1,
): number {
  if (cash.lte(ZERO)) return 0;
  const first = costOfNext(def, owned, discount);
  if (cash.lt(first)) return 0;

  const ratio = cash.mul(COST_MULTIPLIER - 1).div(first).add(ONE);
  let k = Math.floor(ratio.ln() / LN_COST_MULTIPLIER);
  if (!Number.isFinite(k) || k < 1) k = 1;

  // Correct floating-point drift. Both loops move at most a step or two.
  let guard = 64;
  while (k > 0 && buyCost(def, owned, k, discount).gt(cash) && guard-- > 0) k -= 1;
  guard = 64;
  while (buyCost(def, owned, k + 1, discount).lte(cash) && guard-- > 0) k += 1;

  return Math.max(0, k);
}

/** The `cost` perk's discount on every unit price. 1 when nothing is bought. */
export function unitCostMultiplier(state: GameState): number {
  return perkUnitCostMultiplier(state);
}

/** Price of automating a business, after the `manager` perk. */
export function managerCost(state: GameState, id: BusinessId): Decimal {
  return getDef(id).managerCost.mul(perkManagerCostMultiplier(state));
}

/** Resolve the ×1/×10/×100/MAX toggle into a concrete unit count. */
export function resolveBuyCount(state: GameState, id: BusinessId, amount?: BuyAmount): number {
  const buyAmount = amount ?? state.buyAmount;
  const def = getDef(id);
  const bs = getBusiness(state, id);
  if (buyAmount === 'MAX') return maxBuy(def, bs.owned, state.cash, unitCostMultiplier(state));
  return buyAmount;
}

/** Cost of the current buy-toggle selection for a business. */
export function costForAmount(state: GameState, id: BusinessId, amount?: BuyAmount): Decimal {
  const count = resolveBuyCount(state, id, amount);
  return buyCost(getDef(id), getBusiness(state, id).owned, count, unitCostMultiplier(state));
}

/** Can the player afford the current buy-toggle selection? MAX of 0 is never affordable. */
export function canAfford(state: GameState, id: BusinessId, amount?: BuyAmount): boolean {
  const count = resolveBuyCount(state, id, amount);
  if (count <= 0) return false;
  return state.cash.gte(costForAmount(state, id, amount));
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

/** The last hand-paced threshold; everything past it is spaced by MILESTONE_STEP. */
const LAST_LISTED_MILESTONE = MILESTONES[MILESTONES.length - 1];

/**
 * How many milestone thresholds the owned count has passed.
 *
 * Unbounded past the listed ladder: `MILESTONES` sets the pacing of the early
 * game, then every `MILESTONE_STEP` units is another one, forever. There is no
 * "all milestones reached" state any more, by design — see MILESTONE_STEP.
 */
export function milestoneCount(owned: number): number {
  if (!Number.isFinite(owned) || owned <= 0) return 0;
  if (owned < LAST_LISTED_MILESTONE) {
    let count = 0;
    for (const threshold of MILESTONES) {
      if (owned >= threshold) count += 1;
      else break;
    }
    return count;
  }
  return MILESTONES.length + Math.floor((owned - LAST_LISTED_MILESTONE) / MILESTONE_STEP);
}

/**
 * Milestone multiplier for a business: 2^(milestones reached).
 *
 * A `Decimal`, not a number: the ladder has no top, and 2^n stops being
 * representable as a JS number at n = 1024 — a count an endless ladder does
 * reach. Returning a float there would silently pay `Infinity`.
 */
export function milestoneMult(owned: number): Decimal {
  return Decimal.pow(2, milestoneCount(owned));
}

/** Next milestone threshold. Never null — there is always another one. */
export function nextMilestone(owned: number): number {
  for (const threshold of MILESTONES) {
    if (owned < threshold) return threshold;
  }
  const past = Math.floor((owned - LAST_LISTED_MILESTONE) / MILESTONE_STEP) + 1;
  return LAST_LISTED_MILESTONE + past * MILESTONE_STEP;
}

/** Units still needed for the next ×2. Always a positive number. */
export function unitsToNextMilestone(owned: number): number {
  return nextMilestone(owned) - owned;
}

// ---------------------------------------------------------------------------
// Speed
// ---------------------------------------------------------------------------

/** How many speed thresholds the owned count has passed. */
export function speedCount(owned: number): number {
  let count = 0;
  for (const threshold of SPEED_MILESTONES) {
    if (owned >= threshold) count += 1;
    else break;
  }
  return count;
}

/**
 * Effective seconds per cycle, after speed milestones.
 *
 * This is the ONE place cycle length is decided. `def.cycleTime` is the value at
 * zero speed milestones and must not be read directly by the engine, the income
 * maths or the UI — halving it doubles income, so a caller using the raw value
 * silently disagrees with the rest of the game about how much a tier earns.
 */
export function cycleTimeFor(def: BusinessDef, owned: number): number {
  const scaled = def.cycleTime / Math.pow(2, speedCount(owned));
  return Math.max(MIN_CYCLE_SECONDS, scaled);
}

/** Effective cycle time for a business in the current state. */
export function cycleTime(state: GameState, id: BusinessId): number {
  return cycleTimeFor(getDef(id), getBusiness(state, id).owned);
}

/** Next owned count that halves the cycle, or null once all are passed. */
export function nextSpeedMilestone(owned: number): number | null {
  for (const threshold of SPEED_MILESTONES) {
    if (owned < threshold) return threshold;
  }
  return null;
}

/** Units still needed for the next speed-up, or null once all are passed. */
export function unitsToNextSpeed(owned: number): number | null {
  const next = nextSpeedMilestone(owned);
  return next === null ? null : next - owned;
}

/**
 * True once a tier cycles faster than the UI can honestly draw, at which point
 * it is rendered as a continuous stream rather than a filling bar.
 */
export function isContinuous(def: BusinessDef, owned: number): boolean {
  return owned > 0 && cycleTimeFor(def, owned) <= CONTINUOUS_CYCLE_SECONDS;
}

// ---------------------------------------------------------------------------
// Cash upgrades
//
// One endless track per tier, bought with cash and wiped by prestige. See the
// constants in businesses.ts for why the price outgrows the payoff.
// ---------------------------------------------------------------------------

/** Upgrade level of a tier. Tolerates a save written before upgrades existed. */
export function upgradeLevel(state: GameState, id: BusinessId): number {
  const level = state.upgrades?.[id];
  return typeof level === 'number' && Number.isFinite(level) && level > 0 ? Math.floor(level) : 0;
}

/**
 * Profit multiplier a tier gets from its upgrades: 2^level.
 *
 * A `Decimal` for the same reason `milestoneMult` is one — the track has no
 * top, and a float would quietly become Infinity somewhere past level 1024.
 */
export function upgradeMult(state: GameState, id: BusinessId): Decimal {
  return Decimal.pow(UPGRADE_STEP, upgradeLevel(state, id));
}

/** Price of the upgrade that takes a tier from `level` to `level + 1`. */
export function upgradeCostFor(def: BusinessDef, level: number): Decimal {
  return def.baseCost.mul(UPGRADE_COST_FACTOR).mul(Decimal.pow(UPGRADE_COST_GROWTH, level));
}

/** Price of the next upgrade for a tier in the current state. */
export function upgradeCost(state: GameState, id: BusinessId): Decimal {
  return upgradeCostFor(getDef(id), upgradeLevel(state, id));
}

/**
 * Can the tier be upgraded right now?
 *
 * Gated on owning at least one unit: an upgrade multiplies a tier's output, and
 * offering to double nothing is a way to take a new player's money for no
 * effect whatsoever.
 */
export function canBuyUpgrade(state: GameState, id: BusinessId): boolean {
  if (getBusiness(state, id).owned <= 0) return false;
  return state.cash.gte(upgradeCost(state, id));
}

/** Upgrade levels bought across every tier — the achievement metric. */
export function totalUpgradeLevels(state: GameState): number {
  return BUSINESSES.reduce((sum, def) => sum + upgradeLevel(state, def.id), 0);
}

// ---------------------------------------------------------------------------
// Multipliers
// ---------------------------------------------------------------------------

/** Is the temporary profit boost running? */
export function isBoostActive(state: GameState): boolean {
  return state.boostRemainingMs > 0;
}

/**
 * Permanent prestige multiplier — now earned by *spending* investors in the
 * skill tree rather than by holding them. See `perks.ts` for why.
 */
export function investorMultiplier(state: GameState): number {
  return perkProfitMultiplier(state);
}

/** Everything that scales all businesses at once: perks × active boost. */
export function globalMultiplier(state: GameState): number {
  const boost = isBoostActive(state) ? state.boostMultiplier : 1;
  return investorMultiplier(state) * boost;
}

// ---------------------------------------------------------------------------
// Revenue
// ---------------------------------------------------------------------------

/**
 * Revenue of one full cycle:
 *   baseRevenue * owned * milestoneMult(owned) * upgradeMult * globalMult
 *
 * `globalMult` is passed in so a tick can compute it once for all businesses;
 * `upgradeMult` is per tier, so it is passed in per business.
 */
export function cycleRevenueFor(
  def: BusinessDef,
  owned: number,
  globalMult: number,
  upgradeMult: Decimal = ONE,
): Decimal {
  if (owned <= 0) return ZERO;
  return def.baseRevenue.mul(owned).mul(milestoneMult(owned)).mul(upgradeMult).mul(globalMult);
}

/** Revenue of one full cycle of a business in the current state. */
export function cycleRevenue(state: GameState, id: BusinessId): Decimal {
  const bs = getBusiness(state, id);
  return cycleRevenueFor(getDef(id), bs.owned, globalMultiplier(state), upgradeMult(state, id));
}

/** A single business's income rate, ignoring whether it is automated. */
export function businessPerSecond(state: GameState, id: BusinessId): Decimal {
  const bs = getBusiness(state, id);
  return cycleRevenue(state, id).div(cycleTimeFor(getDef(id), bs.owned));
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
    const revenue = cycleRevenueFor(def, bs.owned, globalMult, upgradeMult(state, def.id));
    total = total.add(revenue.div(cycleTimeFor(def, bs.owned)));
  }
  return total;
}

// ---------------------------------------------------------------------------
// Prestige
// ---------------------------------------------------------------------------

/**
 * Total investors a given lifetime-earnings figure is worth:
 * floor(150 * sqrt(lifetime / 1e9) * payoutMult). First investor at ~€44.4k
 * lifetime, before the `payout` perk raises the whole curve.
 */
export function investorsForLifetime(lifetimeEarnings: Decimal, payoutMult = 1): number {
  if (lifetimeEarnings.lte(ZERO)) return 0;
  const total = lifetimeEarnings
    .div(PRESTIGE_DIVISOR)
    .sqrt()
    .mul(PRESTIGE_FACTOR)
    .mul(payoutMult)
    .floor()
    .toNumber();
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
  const worth = investorsForLifetime(state.lifetimeEarnings, perkPayoutMultiplier(state));
  return Math.max(0, worth - state.investors);
}

/** Prestige is offered once it would grant at least one investor. */
export function canPrestige(state: GameState): boolean {
  return prestigeGain(state) >= 1;
}

/** Lifetime earnings required for the next investor (for a progress hint). */
export function lifetimeForInvestors(investors: number, payoutMult = 1): Decimal {
  const root = investors / (PRESTIGE_FACTOR * payoutMult);
  return D(PRESTIGE_DIVISOR).mul(root * root);
}

// ---------------------------------------------------------------------------
// Offline
// ---------------------------------------------------------------------------

/** Elapsed seconds after the offline cap (12h, plus the `offline` perk). */
export function cappedOfflineSeconds(
  elapsedSeconds: number,
  capSeconds = OFFLINE_CAP_SECONDS,
): number {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return 0;
  return Math.min(elapsedSeconds, capSeconds);
}

/** The player's current offline cap, after the `offline` perk. */
export function offlineCapSeconds(state: GameState): number {
  return perkOfflineCapSeconds(state);
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
