/**
 * P1 — Collapse (spec §7).
 *
 * Resets Layer 0 (Spark, orbiter tiers, Spark upgrades, Motes + Resonance,
 * Dimension Boosts) for Shards. Shards multiply all production (composed in
 * multipliers.ts — the multiplier is always recomputed from `state.shards`,
 * never stored, per the §19 prototype-bug note) and buy the Star Chart and
 * the Shard upgrade tree.
 */
import { BAL, ShardUpgradeDef } from '../balance';
import { Decimal, ZERO, clean } from '../numbers';
import { GameState } from '../types';
import { freshDims } from './dimensions';
import { emberStartSpark, keptDimBoosts, moteKeepFraction, shardUpgradeLevel } from './shardperks';
import { upgradeCost } from './upgrades';

/** The Prestige tab reveals once the player has ever qualified or collapsed. */
export function collapseUnlocked(state: GameState): boolean {
  return (
    state.collapses > 0 ||
    state.shardsEver.gt(ZERO) ||
    state.bestSparkRun.gte(BAL.collapse.unlockSpark)
  );
}

/** Shards granted by collapsing right now: floor((best/coef)^exp). */
export function collapseGain(state: GameState): Decimal {
  if (state.bestSparkRun.lt(BAL.collapse.unlockSpark)) return ZERO;
  return clean(state.bestSparkRun.div(BAL.collapse.coef).pow(BAL.collapse.exp).floor());
}

export function canCollapse(state: GameState): boolean {
  return collapseGain(state).gte(1);
}

/**
 * Perform a Collapse. Mutates `state`; returns success.
 *
 * Resets exactly: spark, bestSparkRun, dims, sparkUpgrades, dimBoosts
 * (minus Boost Echo), motes (minus Mote Echo) and moteUpgrades.
 * Keeps: shards & tree, star chart, automation toggles, lifetime stats.
 */
export function doCollapse(state: GameState): boolean {
  if (!canCollapse(state)) return false;
  const gain = collapseGain(state);

  state.shards = clean(state.shards.add(gain));
  state.shardsEver = clean(state.shardsEver.add(gain));
  if (state.shards.gt(state.bestShards)) state.bestShards = state.shards;
  state.collapses += 1;

  const boostsKept = keptDimBoosts(state);
  state.dimBoosts = boostsKept;
  state.dims = freshDims(boostsKept);
  // At minimum the run restarts with enough for one Tier-1 orbiter, so an
  // idle player (with autobuyers) is never soft-deadlocked at zero production.
  state.spark = Decimal.max(emberStartSpark(state), BAL.dimBoost.startingSpark);
  state.bestSparkRun = state.spark;
  state.sparkUpgrades = {};

  state.motes = clean(state.motes.mul(moteKeepFraction(state)));
  state.moteUpgrades = {};

  return true;
}

// ---------------------------------------------------------------------------
// Shard upgrade tree
// ---------------------------------------------------------------------------

const shardDefs = new Map(BAL.shardUpgrades.map((u) => [u.id, u]));

export function shardUpgradeDef(id: string): ShardUpgradeDef | undefined {
  return shardDefs.get(id);
}

export function shardUpgradeCost(def: ShardUpgradeDef, level: number): Decimal {
  return upgradeCost(def, level);
}

/** Buy one level of a Shard upgrade if affordable. Returns true on purchase. */
export function buyShardUpgrade(state: GameState, id: string): boolean {
  const def = shardDefs.get(id);
  if (!def) return false;
  const level = shardUpgradeLevel(state, id);
  if (def.maxLevel !== null && level >= def.maxLevel) return false;
  const cost = shardUpgradeCost(def, level);
  if (state.shards.lt(cost)) return false;
  state.shards = state.shards.sub(cost);
  state.shardUpgrades = { ...state.shardUpgrades, [id]: level + 1 };
  return true;
}
