/**
 * P1 — Collapse (spec §7).
 *
 * Resets Layer 0 (Spark, orbiter tiers, Spark upgrades, Motes + Resonance,
 * Dimension Boosts) for Shards. Shards multiply all production (composed in
 * multipliers.ts — the multiplier is always recomputed from `state.shards`,
 * never stored, per the §19 prototype-bug note) and buy the Star Chart and
 * the Shard upgrade tree.
 */
import { BAL, PrismUpgradeDef, ShardUpgradeDef } from '../balance';
import { D, Decimal, ZERO, clean } from '../numbers';
import { GameState } from '../types';
import { freshDims } from './dimensions';
import { emberStartSpark, keptDimBoosts, moteKeepFraction, shardUpgradeLevel } from './shardperks';
import { upgradeCost } from './upgrades';

/** Total Trial tiers cleared — the sideways gate the deep layers read. */
export function trialTiersCleared(state: GameState): number {
  return Object.values(state.challenges).reduce((a, b) => a + b, 0);
}

/** The Prestige tab reveals once the player has ever qualified or collapsed. */
export function collapseUnlocked(state: GameState): boolean {
  return (
    state.collapses > 0 ||
    state.shardsEver.gt(ZERO) ||
    state.bestSparkRun.gte(BAL.collapse.unlockSpark)
  );
}

/**
 * Shards per decade of Spark, after the Resolve prism upgrade.
 *
 * Resolve is P2 buying P1's RATE rather than more production, so the layer
 * below never goes obsolete — the sideways interlock of balance.ts rule 3, and
 * one of the two accelerators that keep the deep cadence from going flat (see
 * BAL.gainAccelerators).
 */
export function shardsPerDecade(state: GameState): number {
  const def = BAL.prismGrid.find((u) => u.id === 'resolve')!;
  const level = state.prismGrid['resolve'] ?? 0;
  return BAL.collapse.perDecade * Math.pow(def.effectPerLevel.toNumber(), level);
}

/**
 * Shards granted by collapsing right now:
 * floor(shardsPerDecade · log10(best/coef)). Logarithmic on purpose — see
 * BAL.collapse.
 */
export function collapseGain(state: GameState): Decimal {
  if (state.bestSparkRun.lt(BAL.collapse.unlockSpark)) return ZERO;
  const decades = state.bestSparkRun.div(BAL.collapse.coef).log10();
  if (!Number.isFinite(decades) || decades <= 0) return ZERO;
  return clean(D(Math.floor(decades * shardsPerDecade(state))));
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
  state.runSeconds = 0;
}

export function doCollapse(state: GameState): boolean {
  if (!canCollapse(state)) return false;
  const gain = collapseGain(state);

  state.shards = clean(state.shards.add(gain));
  state.shardsEver = clean(state.shardsEver.add(gain));
  if (state.shards.gt(state.bestShards)) state.bestShards = state.shards;
  if (gain.gt(state.bestCollapseGain)) state.bestCollapseGain = gain;
  state.collapses += 1;

  resetLayer0(state);
  return true;
}

// ---------------------------------------------------------------------------
// P2 — Ascend (spec §7)
// ---------------------------------------------------------------------------

/**
 * Every prestige gate reads the cycle's LIFETIME counter (`shardsEver`,
 * `prismEver`, `aeonEver`), never the spendable balance.
 *
 * Reading the balance would mean that buying a Star Chart node or an Aeon
 * node pushed the next layer further away — the game punishing you for
 * playing it. It is also how Unify became unreachable in testing: the Aeon
 * tree costs 14 Aeon in total, so a player who bought it could never hold the
 * 10 the gate demanded. The multipliers already read *Ever for the same
 * reason; the gates now match. Each of these counters still resets with its
 * own layer, so they measure the current cycle, not all of history.
 */

/** The Ascend card reveals once the player has ever qualified or ascended. */
export function ascendUnlocked(state: GameState): boolean {
  return state.ascends > 0 || state.shardsEver.gte(BAL.ascend.unlockShards);
}

/**
 * Prism granted by ascending now: floor((shardsEver/coef)^exp), plus one
 * free Prism per completed Dim challenge tier (read straight from state to
 * keep prestige ← challenges import one-way).
 */
export function ascendGain(state: GameState): Decimal {
  if (state.shardsEver.lt(BAL.ascend.unlockShards)) return ZERO;
  const reachDef = BAL.aeonUpgrades.find((u) => u.id === 'aeonReach')!;
  const reach = reachDef.effectPerLevel.pow(state.aeonGrid['aeonReach'] ?? 0);
  const base = state.shardsEver.div(BAL.ascend.coef).pow(BAL.ascend.exp).mul(reach).floor();
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
  state.bestCollapseGain = ZERO;
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
  return state.converges > 0 || state.prismEver.gte(BAL.converge.unlockPrism);
}

/**
 * Aeon granted by converging now: floor((prismEver/coef)^exp).
 *
 * Sublinear, but a POWER law rather than the log2 it started as — see
 * BAL.converge for why the log made the fifth Converge unreachable.
 */
export function convergeGain(state: GameState): Decimal {
  if (state.prismEver.lt(BAL.converge.unlockPrism)) return ZERO;
  return clean(state.prismEver.div(BAL.converge.coef).pow(BAL.converge.exp).floor());
}

/**
 * Converge needs Prism AND cleared Trials (BAL.gates).
 *
 * This is the gate that makes Trials part of the game rather than a side
 * cabinet: the main loop is what makes a Trial winnable, and Trial rewards are
 * what let the main loop go deeper. Five tiers of forty is a gentle ask — it
 * decides the ORDER you do things in, never whether you can.
 */
export function convergeTrialsMet(state: GameState): boolean {
  return trialTiersCleared(state) >= BAL.gates.convergeTrialTiers;
}

export function canConverge(state: GameState): boolean {
  return convergeGain(state).gte(1) && convergeTrialsMet(state);
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

  // Elements allocation refunds to the pool; the points survive. Held
  // Spectrum (Aeon tree) keeps the allocation itself.
  if (!state.aeonTree['keepElements']) {
    const refund = Object.values(state.elements.alloc).reduce((a, b) => a + b, 0);
    state.elements = { ...state.elements, points: state.elements.points + refund, alloc: {} };
  }

  /*
   * Ore and Miners are NOT touched here — they survive Converge and reset only
   * at Unify. Wiping them at every Converge is most of why mining was
   * pointless: the lane the spec calls "the permanent, slow, compounding
   * backbone" was being cleared roughly once an hour, so it never compounded.
   */

  // P1 layer + Layer 0, with NO keep perks (they were all cleared).
  state.shards = ZERO;
  state.bestShards = ZERO;
  state.shardsEver = ZERO;
  state.bestCollapseGain = ZERO;
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
  return state.unifies > 0 || state.aeonEver.gte(BAL.unify.unlockAeon);
}

/** Singularity granted by unifying now: floor((aeonEver/coef)^exp). */
export function unifyGain(state: GameState): Decimal {
  if (state.aeonEver.lt(BAL.unify.unlockAeon)) return ZERO;
  return clean(state.aeonEver.div(BAL.unify.coef).pow(BAL.unify.exp).floor());
}

/**
 * Unify's gates, as a list the UI can render one by one.
 *
 * Four conditions from four different systems: the prestige ladder (Aeon), the
 * mining lane (the Seed and Deep Refinement) and the Trials. You cannot ride a
 * single lane to the end of GYRE — that is the shape of the whole endgame, and
 * it is what gives a route something to optimise.
 */
export interface UnifyGate {
  id: string;
  label: string;
  met: boolean;
}

export function unifyGates(state: GameState): UnifyGate[] {
  const tiers = trialTiersCleared(state);
  const refine = state.researchGrid['deepRefine'] ?? 0;
  return [
    {
      id: 'aeon',
      label: `Earn ${BAL.unify.unlockAeon.toString()} Aeon this cycle`,
      met: unifyGain(state).gte(1),
    },
    {
      id: 'seed',
      label: 'Buy the Singularity Seed research',
      met: state.research['singularitySeed'] === true,
    },
    {
      id: 'trials',
      label: `Clear ${BAL.gates.unifyTrialTiers} Trial tiers (${tiers})`,
      met: tiers >= BAL.gates.unifyTrialTiers,
    },
    {
      id: 'refine',
      label: `Deep Refinement level ${BAL.gates.unifyRefineLevels} (${refine})`,
      met: refine >= BAL.gates.unifyRefineLevels,
    },
  ];
}

export function canUnify(state: GameState): boolean {
  return unifyGates(state).every((g) => g.met);
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
  state.aeonGrid = {};

  // Minerals, Research (unless archived) and Flux gone.
  if (!state.metaShop['keepMiners']) {
    state.ore = ZERO;
    state.oreEver = ZERO;
    state.miners = {};
  }
  if (!state.metaShop['keepResearch']) {
    state.research = {};
    state.researchGrid = {};
  }
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
  state.bestCollapseGain = ZERO;
  state.shardUpgrades = {};
  state.starChart = state.metaShop['keepChart2'] ? { ...state.starChart } : {};
  state.activeChallenge = null;
  state.challengeElapsed = 0;

  resetLayer0(state);

  // Deep Memory: the new cycle begins with a little Aeon warmth.
  if (state.metaShop['starterAeon']) {
    state.aeon = D(5);
    state.aeonEver = D(5);
    state.bestAeon = D(5);
  }

  // Manager slots may have shrunk with Research — trim the assignments.
  let slots = BAL.managers.baseSlots;
  if (state.research['slotA']) slots += 1;
  if (state.research['slotB']) slots += 1;
  if (state.research['slotC']) slots += 1;
  state.boostSlots = state.boostSlots.slice(0, slots);

  return true;
}

// ---------------------------------------------------------------------------
// "Worth taking?" — the shared sensible-player rule
// ---------------------------------------------------------------------------

/**
 * Should a sensible player take this reset right now?
 *
 * One definition, used by both the auto-prestige toggles (systems/automation)
 * and the balance harnesses, so the bot in the ladder report is playing the
 * same game the autobuyers play. The per-layer thresholds and the reasoning
 * behind them live in BAL.prestigeStep.
 *
 * Each rule reads the LIFETIME counter, matching the multipliers: spending
 * Shards or Aeon must never make the next reset look less attractive.
 */
/**
 * Collapse when this run beats the best run of this cycle — or when you have
 * simply been at it long enough.
 *
 * NOT "a fraction of shardsEver", and NOT "better than average" either. See
 * the long note on BAL.prestigeStep: the fraction rule stalls (a log gain
 * against an unbounded sum) and the average rule collapses into a two-second
 * loop (every quick reset lowers its own bar). A running MAXIMUM can do
 * neither — it only goes up, and it goes up exactly as fast as the runs do.
 *
 * The patience clause is what makes a monotone bar safe: a bar that only rises
 * can become unreachable, and a stalled P1 starves every layer above it.
 */
export function worthCollapsing(state: GameState): boolean {
  if (!canCollapse(state)) return false;
  if (state.collapses === 0) return true;
  if (state.runSeconds >= BAL.prestigeStep.collapsePatienceSeconds) return true;
  return collapseGain(state).gte(
    state.bestCollapseGain.mul(BAL.prestigeStep.collapseBeatsBest),
  );
}

export function worthAscending(state: GameState): boolean {
  if (!canAscend(state)) return false;
  if (state.ascends === 0) return true;
  return ascendGain(state).gte(state.prismEver.mul(BAL.prestigeStep.ascend));
}

export function worthConverging(state: GameState): boolean {
  if (!canConverge(state)) return false;
  if (state.converges === 0) return true;
  return convergeGain(state).gte(state.aeonEver.mul(BAL.prestigeStep.converge));
}

export function worthUnifying(state: GameState): boolean {
  if (!canUnify(state)) return false;
  if (state.unifies === 0) return true;
  return unifyGain(state).gte(state.singularityEver.mul(BAL.prestigeStep.unify));
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

// ---------------------------------------------------------------------------
// The endless grids — Aeon's and Singularity's own uncapped lanes
// ---------------------------------------------------------------------------

/**
 * Rule 2 of the rebalance: every currency owns at least one uncapped,
 * geometrically-priced multiplier. Without these, Aeon past its six-node tree
 * and Singularity past its eight-item shop are numbers that go up for no
 * reason — and those are the two currencies a player spends the last three
 * weeks of the game earning.
 *
 * One factory rather than two copies of the same twelve lines: the grids
 * differ only in which record they live in and which balance they spend.
 */
function gridBuyer(
  defs: readonly PrismUpgradeDef[],
  read: (s: GameState) => Record<string, number>,
  write: (s: GameState, next: Record<string, number>) => void,
  balance: (s: GameState) => Decimal,
  pay: (s: GameState, cost: Decimal) => void,
) {
  const byId = new Map(defs.map((d) => [d.id, d]));
  return {
    level: (state: GameState, id: string): number => read(state)[id] ?? 0,
    cost: (state: GameState, id: string): Decimal =>
      upgradeCost(byId.get(id)!, read(state)[id] ?? 0),
    buy: (state: GameState, id: string): boolean => {
      const def = byId.get(id);
      if (!def) return false;
      const level = read(state)[id] ?? 0;
      if (def.maxLevel !== null && level >= def.maxLevel) return false;
      const cost = upgradeCost(def, level);
      if (balance(state).lt(cost)) return false;
      pay(state, cost);
      write(state, { ...read(state), [id]: level + 1 });
      return true;
    },
  };
}

const aeonGridOps = gridBuyer(
  BAL.aeonUpgrades,
  (s) => s.aeonGrid,
  (s, next) => {
    s.aeonGrid = next;
  },
  (s) => s.aeon,
  (s, cost) => {
    s.aeon = s.aeon.sub(cost);
  },
);

export const aeonGridLevel = aeonGridOps.level;
export const aeonGridCost = aeonGridOps.cost;
export const buyAeonGrid = aeonGridOps.buy;

const metaGridOps = gridBuyer(
  BAL.metaGrid,
  (s) => s.metaGrid,
  (s, next) => {
    s.metaGrid = next;
  },
  (s) => s.singularity,
  (s, cost) => {
    s.singularity = s.singularity.sub(cost);
  },
);

export const metaGridLevel = metaGridOps.level;
export const metaGridCost = metaGridOps.cost;
export const buyMetaGrid = metaGridOps.buy;
