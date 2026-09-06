/**
 * Star Chart (spec §8.1): a node graph bought with Shards. Node effects
 * compose into the multiplier stack (multipliers.ts) and into tapPower,
 * moteRate, oreRate and the offline cap.
 *
 * NODES ARE RANKED (Phase 12). Each rank costs `baseCost · costGrowth^rank`
 * and grants the node's effect again, multiplicatively. As a set of one-time
 * switches the whole chart was worth a fixed ×3 and was bought out during the
 * first Ascend, after which Shards — the entire reward of the P1 layer —
 * bought nothing at all for the rest of the game. Ranks make the chart the
 * Shard sink it was always drawn as.
 *
 * Respec is free: all ranks clear and every spent Shard refunds.
 */
import { BAL, StarNodeDef } from '../balance';
import { Decimal, ONE, ZERO, cleanMul } from '../numbers';
import { GameState } from '../types';
import { upgradeCost } from './upgrades';

const nodeById = new Map(BAL.starChart.map((n) => [n.id, n]));

export function starNodeDef(id: string): StarNodeDef | undefined {
  return nodeById.get(id);
}

/** Ranks bought of a node. 0 = not owned. */
export function nodeRank(state: GameState, id: string): number {
  return state.starChart[id] ?? 0;
}

/** Owned at all? (Prerequisites read rank ≥ 1.) */
export function nodeActive(state: GameState, id: string): boolean {
  return nodeRank(state, id) > 0;
}

export function nodeMaxed(state: GameState, id: string): boolean {
  const def = nodeById.get(id);
  if (!def) return false;
  return def.maxRank !== null && nodeRank(state, id) >= def.maxRank;
}

/** Cost of the NEXT rank of a node. */
export function nodeCost(state: GameState, id: string): Decimal {
  const def = nodeById.get(id)!;
  return upgradeCost(def, nodeRank(state, id));
}

/** Ring 1 opens with P1, ring 2 at Ascend, ring 3 at Converge. */
export function ringUnlocked(state: GameState, ring: number): boolean {
  if (ring === 1) return true;
  if (ring === 2) return state.ascends > 0;
  return state.converges > 0;
}

export function starChartUnlocked(state: GameState): boolean {
  return state.collapses > 0 || state.shardsEver.gt(ZERO);
}

export function canBuyNode(state: GameState, id: string): boolean {
  const def = nodeById.get(id);
  if (!def) return false;
  if (nodeMaxed(state, id)) return false;
  if (!ringUnlocked(state, def.ring)) return false;
  if (!def.requires.every((r) => nodeActive(state, r))) return false;
  return state.shards.gte(nodeCost(state, id));
}

/** Buy one rank of a node. Mutates `state`; returns success. */
export function buyStarNode(state: GameState, id: string): boolean {
  if (!canBuyNode(state, id)) return false;
  const cost = nodeCost(state, id);
  state.shards = state.shards.sub(cost);
  state.starChart = { ...state.starChart, [id]: nodeRank(state, id) + 1 };
  return true;
}

/**
 * Shards currently invested across every rank of every node — the geometric
 * series baseCost·(g^rank − 1)/(g − 1), or baseCost·rank when g is 1 (servo4).
 */
export function starChartSpent(state: GameState): Decimal {
  let total = ZERO;
  for (const def of BAL.starChart) {
    const rank = nodeRank(state, def.id);
    if (rank <= 0) continue;
    if (def.costGrowth.lte(ONE)) {
      total = total.add(def.baseCost.mul(rank));
      continue;
    }
    total = total.add(
      def.baseCost.mul(def.costGrowth.pow(rank).sub(ONE)).div(def.costGrowth.sub(ONE)),
    );
  }
  return total;
}

/** Clear every rank and refund every spent Shard. */
export function respecStarChart(state: GameState): void {
  state.shards = state.shards.add(starChartSpent(state));
  state.starChart = {};
}

// ---------------------------------------------------------------------------
// Effect composition (read by multipliers.ts and friends)
// ---------------------------------------------------------------------------

/**
 * Product of `pick(def)^rank` over every owned node — the one place ranks
 * turn into a multiplier, so every effect kind gets the same treatment.
 */
function productOf(state: GameState, pick: (def: StarNodeDef) => Decimal | null): Decimal {
  let m = ONE;
  for (const def of BAL.starChart) {
    const rank = nodeRank(state, def.id);
    if (rank <= 0) continue;
    const part = pick(def);
    if (part) m = m.mul(part.pow(rank));
  }
  return cleanMul(m);
}

export function starGlobalMult(state: GameState): Decimal {
  return productOf(state, (d) => (d.effect.kind === 'global' ? d.effect.mult : null));
}

export function starTierMult(state: GameState, tier: number): Decimal {
  return productOf(state, (d) =>
    d.effect.kind === 'tier' && d.effect.tier === tier ? d.effect.mult : null,
  );
}

export function starMoteMult(state: GameState): Decimal {
  return productOf(state, (d) => (d.effect.kind === 'mote' ? d.effect.mult : null));
}

export function starOreMult(state: GameState): Decimal {
  return productOf(state, (d) => (d.effect.kind === 'ore' ? d.effect.mult : null));
}

export function starTapMult(state: GameState): Decimal {
  return productOf(state, (d) => (d.effect.kind === 'tap' ? d.effect.mult : null));
}

export function starSpeedMult(state: GameState): Decimal {
  return productOf(state, (d) => (d.effect.kind === 'speed' ? d.effect.mult : null));
}

/** Offline cap hours added by chart nodes — per rank, like every other effect. */
export function starOfflineCapHours(state: GameState): number {
  let hours = 0;
  for (const def of BAL.starChart) {
    const rank = nodeRank(state, def.id);
    if (rank > 0 && def.effect.kind === 'offlineCapH') hours += def.effect.hours * rank;
  }
  return hours;
}

/** Is tier `tier` autobuyable via a chart node (beyond the P1 base 1–3)? */
export function starAutobuyTier(state: GameState, tier: number): boolean {
  return BAL.starChart.some(
    (d) =>
      nodeActive(state, d.id) && d.effect.kind === 'autobuyTier' && d.effect.tier === tier,
  );
}
