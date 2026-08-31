/**
 * Orbiter dimension chain (spec §6.2) — the main producer.
 *
 * Tier 1 orbiters produce Spark; Tier k (k ≥ 2) orbiters produce Tier k-1
 * orbiters. Costs are geometric in purchase count, paid in Spark for every
 * tier. Dimension Boost is the Layer-0 soft reset: purchases reset for a
 * permanent ×2 to all tier multipliers plus the next tier unlocking.
 */
import { BAL } from '../balance';
import { D, Decimal, ONE, ZERO, clean } from '../numbers';
import { BuyAmount, DimensionTier, GameState } from '../types';
import { challengeActive, costGrowthFor } from './challengeperks';
import { globalMult, sparkMult, speedMult, tierMult } from './multipliers';

export const TIER_COUNT = BAL.dimensions.length;

/** Effective cost growth for a tier — Brittle challenge/reward adjusted. */
function tierGrowth(state: GameState, tier: number): Decimal {
  return costGrowthFor(state, BAL.dimensions[tier - 1].costGrowth);
}

/** Cost of the next single purchase of a tier (1-indexed). */
export function dimCost(state: GameState, tier: number): Decimal {
  const def = BAL.dimensions[tier - 1];
  const bought = state.dims[tier - 1].bought;
  return def.baseCost.mul(tierGrowth(state, tier).pow(bought));
}

/**
 * Total cost of `n` consecutive purchases from the current count
 * (geometric series: c·(g^n − 1)/(g − 1)).
 */
export function dimCostFor(state: GameState, tier: number, n: number): Decimal {
  if (n <= 0) return ZERO;
  const first = dimCost(state, tier);
  const g = tierGrowth(state, tier);
  return first.mul(g.pow(n).sub(ONE)).div(g.sub(ONE));
}

/** Largest n whose total cost fits in current Spark. */
export function dimMaxAffordable(state: GameState, tier: number): number {
  const first = dimCost(state, tier);
  if (state.spark.lt(first)) return 0;
  const g = tierGrowth(state, tier);
  // spark ≥ first·(g^n − 1)/(g − 1)  ⇒  n ≤ log_g(spark·(g−1)/first + 1)
  const limit = state.spark.mul(g.sub(ONE)).div(first).add(ONE);
  const n = Math.floor(limit.log10() / g.log10());
  // Floating log rounding can be off by one in either direction — verify.
  let best = Math.max(1, n);
  while (best > 0 && dimCostFor(state, tier, best).gt(state.spark)) best -= 1;
  while (dimCostFor(state, tier, best + 1).lte(state.spark)) best += 1;
  return best;
}

/**
 * Buy `amount` of a tier (1 / 10 / MAX). Mutates `state`; returns the number
 * actually bought.
 */
export function buyDim(state: GameState, tier: number, amount: BuyAmount): number {
  const t = state.dims[tier - 1];
  if (!t || !t.unlocked) return 0;
  // Solitary challenge: only Tier-1 orbiters can be bought during the run.
  if (tier > 1 && challengeActive(state, 'solitary')) return 0;
  const n =
    amount === 'MAX'
      ? dimMaxAffordable(state, tier)
      : Math.min(amount, dimMaxAffordable(state, tier));
  if (n <= 0) return 0;
  const cost = dimCostFor(state, tier, n);
  state.spark = clean(state.spark.sub(cost));
  state.dims = state.dims.map((d, i) =>
    i === tier - 1 ? { ...d, bought: d.bought + n, amount: d.amount.add(n) } : d,
  );
  return n;
}

/**
 * Production cascade for dt seconds (spec §6.2): top-down so upper tiers feed
 * lower ones within the same tick. Mutates `state`.
 */
export function tickDimensions(state: GameState, dt: number): void {
  const global = globalMult(state);
  const speed = speedMult(state);
  const spark = sparkMult(state);
  const dims: DimensionTier[] = state.dims.map((d) => ({ ...d }));

  for (let k = TIER_COUNT; k >= 1; k--) {
    const t = dims[k - 1];
    if (t.amount.lte(ZERO)) continue;
    const produced = t.amount
      .mul(BAL.dimensions[k - 1].perOrbiter)
      .mul(tierMult(state, k))
      .mul(global)
      .mul(speed)
      .mul(dt);
    if (k === 1) {
      const gained = clean(produced.mul(spark));
      state.spark = clean(state.spark.add(gained));
      state.totalSpark = clean(state.totalSpark.add(gained));
    } else {
      dims[k - 2].amount = clean(dims[k - 2].amount.add(produced));
    }
  }

  state.dims = dims;
  if (state.spark.gt(state.bestSparkRun)) state.bestSparkRun = state.spark;
}

/** Spark per second at the current state (display only — T1 output). */
export function sparkRate(state: GameState): Decimal {
  const t1 = state.dims[0];
  if (!t1 || t1.amount.lte(ZERO)) return ZERO;
  return clean(
    t1.amount
      .mul(BAL.dimensions[0].perOrbiter)
      .mul(tierMult(state, 1))
      .mul(globalMult(state))
      .mul(speedMult(state))
      .mul(sparkMult(state)),
  );
}

// ---------------------------------------------------------------------------
// Dimension Boost (spec §6.2)
// ---------------------------------------------------------------------------

/** Index (1-based) of the highest currently unlocked tier. */
export function highestUnlockedTier(state: GameState): number {
  let highest = 1;
  state.dims.forEach((d, i) => {
    if (d.unlocked) highest = i + 1;
  });
  return highest;
}

/**
 * Purchases of the highest unlocked tier needed for the next boost. Escalates
 * from the very first boost, so ×2-per-boost can never run away against a
 * fixed price — and so the opening boosts, the only ones a player buys by
 * hand, actually cost something.
 */
export function dimBoostRequirement(state: GameState): number {
  return BAL.dimBoost.requirement + BAL.dimBoost.requirementGrowth * Math.max(0, state.dimBoosts);
}

export function canDimBoost(state: GameState): boolean {
  const highest = highestUnlockedTier(state);
  return state.dims[highest - 1].bought >= dimBoostRequirement(state);
}

export function dimBoostRequirementText(state: GameState): { tier: number; need: number } {
  return { tier: highestUnlockedTier(state), need: dimBoostRequirement(state) };
}

/**
 * Perform a Dimension Boost: resets Spark and all tier purchases/amounts,
 * keeps upgrades and Motes, grants a permanent ×2 tier multiplier and unlocks
 * the next tier (up to TIER_COUNT). Mutates `state`; returns success.
 */
export function doDimBoost(state: GameState): boolean {
  if (!canDimBoost(state)) return false;
  state.dimBoosts += 1;
  state.spark = BAL.dimBoost.startingSpark;
  state.dims = state.dims.map((d, i) => ({
    bought: 0,
    amount: ZERO,
    unlocked: i < BAL.startingTiers + state.dimBoosts,
  }));
  return true;
}

/** Fresh tier array for a new game (or after a future Collapse). */
export function freshDims(dimBoosts = 0): DimensionTier[] {
  return Array.from({ length: TIER_COUNT }, (_, i) => ({
    bought: 0,
    amount: D(0),
    unlocked: i < BAL.startingTiers + dimBoosts,
  }));
}
