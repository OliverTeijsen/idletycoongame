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
import { D, Decimal, ZERO, clean } from '../numbers';
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
/**
 * The shared Layer-0 reset used by Collapse, Ascend and challenge
 * entry/exit/completion. Applies the shard perks (Ember Bank, Mote Echo,
 * Boost Echo) — callers that must not (Ascend clears the perks first).
 */
export function resetLayer0(state: GameState): void {
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
}

export function doCollapse(state: GameState): boolean {
  if (!canCollapse(state)) return false;
  const gain = collapseGain(state);

  state.shards = clean(state.shards.add(gain));
  state.shardsEver = clean(state.shardsEver.add(gain));
  if (state.shards.gt(state.bestShards)) state.bestShards = state.shards;
  state.collapses += 1;

  resetLayer0(state);
  return true;
}

// ---------------------------------------------------------------------------
// P2 — Ascend (spec §7)
// ---------------------------------------------------------------------------

/** The Ascend card reveals once the player has ever qualified or ascended. */
export function ascendUnlocked(state: GameState): boolean {
  return state.ascends > 0 || state.bestShards.gte(BAL.ascend.unlockShards);
}

/**
 * Prism granted by ascending now: floor((bestShards/coef)^exp), plus one
 * free Prism per completed Dim challenge tier (read straight from state to
 * keep prestige ← challenges import one-way).
 */
export function ascendGain(state: GameState): Decimal {
  if (state.bestShards.lt(BAL.ascend.unlockShards)) return ZERO;
  const base = state.bestShards.div(BAL.ascend.coef).pow(BAL.ascend.exp).floor();
  return clean(base.add(state.challenges['dim'] ?? 0));
}

export function canAscend(state: GameState): boolean {
  return ascendGain(state).gte(1);
}

/**
 * Perform an Ascend. Resets everything Collapse resets PLUS the whole P1
 * layer: Shards (balance, best, earned — the shard multiplier reads earned,
 * so it resets too), the Shard tree and the Star Chart allocation. Abandons
 * any active challenge. Keeps: Prism & grid, Elements, challenge
 * completions, automation toggles, lifetime stats.
 */
export function doAscend(state: GameState): boolean {
  if (!canAscend(state)) return false;
  const gain = ascendGain(state);

  state.prism = clean(state.prism.add(gain));
  state.prismEver = clean(state.prismEver.add(gain));
  if (state.prism.gt(state.bestPrism)) state.bestPrism = state.prism;
  state.ascends += 1;

  state.elements = {
    ...state.elements,
    points: state.elements.points + BAL.elements.pointsPerAscend,
  };

  // Aeon-tree keep perks are applied around the reset.
  const keptMotes = state.aeonTree['keepMotes'] ? state.motes.mul(0.5) : ZERO;
  const keptChart = state.aeonTree['keepChart'] ? { ...state.starChart } : {};

  // Clear the P1 layer BEFORE the Layer-0 reset so the shard perks (Ember
  // Bank, Mote Echo, Boost Echo) no longer soften it.
  state.shards = ZERO;
  state.bestShards = ZERO;
  state.shardsEver = ZERO;
  state.shardUpgrades = {};
  state.starChart = keptChart;
  state.activeChallenge = null;

  resetLayer0(state);
  state.motes = clean(Decimal.max(state.motes, keptMotes));
  return true;
}

// ---------------------------------------------------------------------------
// P3 — Converge (spec §7)
// ---------------------------------------------------------------------------

/** The Converge card reveals once the player has ever qualified or converged. */
export function convergeUnlocked(state: GameState): boolean {
  return state.converges > 0 || state.bestPrism.gte(BAL.converge.unlockPrism);
}

/** Aeon granted by converging now: floor(log2(bestPrism + 1)) — slow on purpose. */
export function convergeGain(state: GameState): Decimal {
  if (state.bestPrism.lt(BAL.converge.unlockPrism)) return ZERO;
  const log2 = state.bestPrism.add(1).log2();
  return clean(D(Math.floor(log2)));
}

export function canConverge(state: GameState): boolean {
  return convergeGain(state).gte(1);
}

/**
 * Perform a Converge. Resets everything Ascend resets PLUS the P2 layer:
 * Prism (balance, best, earned), the Prism grid and the Elements allocation
 * (points refund to the pool) — and, per §8.3, Ore and Miners. Keeps: Aeon
 * & tree, Research, challenge completions, element points, lifetime stats.
 */
export function doConverge(state: GameState): boolean {
  if (!canConverge(state)) return false;
  const gain = convergeGain(state);

  state.aeon = clean(state.aeon.add(gain));
  state.aeonEver = clean(state.aeonEver.add(gain));
  if (state.aeon.gt(state.bestAeon)) state.bestAeon = state.aeon;
  state.converges += 1;

  // P2 layer gone.
  state.prism = ZERO;
  state.bestPrism = ZERO;
  state.prismEver = ZERO;
  state.prismGrid = {};

  // Elements allocation refunds to the pool; the points survive.
  const refund = Object.values(state.elements.alloc).reduce((a, b) => a + b, 0);
  state.elements = { ...state.elements, points: state.elements.points + refund, alloc: {} };

  // Minerals reset here (and only here / Unify) — research survives.
  state.ore = ZERO;
  state.miners = {};

  // P1 layer + Layer 0, with NO keep perks (they were all cleared).
  state.shards = ZERO;
  state.bestShards = ZERO;
  state.shardsEver = ZERO;
  state.shardUpgrades = {};
  state.starChart = {};
  state.activeChallenge = null;

  resetLayer0(state);
  return true;
}

// ---------------------------------------------------------------------------
// P4 — Unify (spec §7): the endgame/meta layer
// ---------------------------------------------------------------------------

/** The Unify card reveals once qualified (Aeon side) or after the first Unify. */
export function unifyUnlocked(state: GameState): boolean {
  return state.unifies > 0 || state.bestAeon.gte(BAL.unify.unlockAeon);
}

/** Singularity granted by unifying now: floor((bestAeon/coef)^exp). */
export function unifyGain(state: GameState): Decimal {
  if (state.bestAeon.lt(BAL.unify.unlockAeon)) return ZERO;
  return clean(state.bestAeon.div(BAL.unify.coef).pow(BAL.unify.exp).floor());
}

/** Unify needs the Aeon threshold AND the Singularity Seed research (§7 gate). */
export function canUnify(state: GameState): boolean {
  return unifyGain(state).gte(1) && state.research['singularitySeed'] === true;
}

/**
 * Perform a Unify. Resets EVERYTHING — the P3 layer (Aeon, tree), Research
 * (unless Eternal Archive), Minerals, Flux, and all layers below. Keeps:
 * Singularity & Meta Shop, challenge completions and element points (their
 * rewards are permanent per §8.4/§8.2), automation toggles, lifetime stats.
 */
export function doUnify(state: GameState): boolean {
  if (!canUnify(state)) return false;
  const gain = unifyGain(state);

  state.singularity = clean(state.singularity.add(gain));
  state.singularityEver = clean(state.singularityEver.add(gain));
  state.unifies += 1;

  // P3 layer gone.
  state.aeon = ZERO;
  state.bestAeon = ZERO;
  state.aeonEver = ZERO;
  state.aeonTree = {};

  // Minerals, Research (unless archived) and Flux gone.
  state.ore = ZERO;
  state.miners = {};
  if (!state.metaShop['keepResearch']) state.research = {};
  state.flux = ZERO;
  state.warpRemaining = 0;
  state.boostRemaining = 0;

  // P2 layer gone.
  state.prism = ZERO;
  state.bestPrism = ZERO;
  state.prismEver = ZERO;
  state.prismGrid = {};
  const refund = Object.values(state.elements.alloc).reduce((a, b) => a + b, 0);
  state.elements = { ...state.elements, points: state.elements.points + refund, alloc: {} };

  // P1 layer + Layer 0 gone.
  state.shards = ZERO;
  state.bestShards = ZERO;
  state.shardsEver = ZERO;
  state.shardUpgrades = {};
  state.starChart = {};
  state.activeChallenge = null;

  resetLayer0(state);

  // Deep Memory: the new cycle begins with a little Aeon warmth.
  if (state.metaShop['starterAeon']) {
    state.aeon = D(2);
    state.aeonEver = D(2);
    state.bestAeon = D(2);
  }

  // Manager slots may have shrunk with Research — trim the assignments.
  let slots = BAL.managers.baseSlots;
  if (state.research['slotA']) slots += 1;
  if (state.research['slotB']) slots += 1;
  state.boostSlots = state.boostSlots.slice(0, slots);

  return true;
}

// ---------------------------------------------------------------------------
// Meta Shop
// ---------------------------------------------------------------------------

export function metaOwned(state: GameState, id: string): boolean {
  return state.metaShop[id] === true;
}

/** Buy a one-time Meta Shop upgrade with Singularity. Returns success. */
export function buyMetaUpgrade(state: GameState, id: string): boolean {
  const def = BAL.metaShop.find((m) => m.id === id);
  if (!def) return false;
  if (metaOwned(state, id)) return false;
  if (state.singularity.lt(def.cost)) return false;
  state.singularity = state.singularity.sub(def.cost);
  state.metaShop = { ...state.metaShop, [id]: true };
  return true;
}

// ---------------------------------------------------------------------------
// Aeon tree (P3's own tree)
// ---------------------------------------------------------------------------

export function aeonNodeOwned(state: GameState, id: string): boolean {
  return state.aeonTree[id] === true;
}

/** Buy a one-time Aeon tree node. Returns success. */
export function buyAeonNode(state: GameState, id: string): boolean {
  const def = BAL.aeonTree.find((n) => n.id === id);
  if (!def) return false;
  if (aeonNodeOwned(state, id)) return false;
  if (state.aeon.lt(def.cost)) return false;
  state.aeon = state.aeon.sub(def.cost);
  state.aeonTree = { ...state.aeonTree, [id]: true };
  return true;
}

// ---------------------------------------------------------------------------
// Prism grid (P2's own tree)
// ---------------------------------------------------------------------------

const prismDefs = new Map(BAL.prismGrid.map((u) => [u.id, u]));

export function prismUpgradeLevel(state: GameState, id: string): number {
  return state.prismGrid[id] ?? 0;
}

export function prismUpgradeCost(id: string, level: number): Decimal {
  const def = prismDefs.get(id)!;
  return upgradeCost(def, level);
}

/** Buy one level of a Prism grid upgrade if affordable. */
export function buyPrismUpgrade(state: GameState, id: string): boolean {
  const def = prismDefs.get(id);
  if (!def) return false;
  const level = prismUpgradeLevel(state, id);
  if (def.maxLevel !== null && level >= def.maxLevel) return false;
  const cost = upgradeCost(def, level);
  if (state.prism.lt(cost)) return false;
  state.prism = state.prism.sub(cost);
  state.prismGrid = { ...state.prismGrid, [id]: level + 1 };
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
