/**
 * Star Chart (spec §8.1): a node graph bought with Shards. Node effects
 * compose into the multiplier stack (multipliers.ts) and into tapPower,
 * moteRate and the offline cap.
 *
 * Respec is free: all nodes deactivate and every spent Shard refunds.
 * (Ascend will also force-refund in Phase 4.)
 */
import { BAL, StarNodeDef } from '../balance';
import { Decimal, ONE, ZERO, cleanMul } from '../numbers';
import { GameState } from '../types';

const nodeById = new Map(BAL.starChart.map((n) => [n.id, n]));

export function starNodeDef(id: string): StarNodeDef | undefined {
  return nodeById.get(id);
}

export function nodeActive(state: GameState, id: string): boolean {
  return state.starChart[id] === true;
}

/** Ring 1 opens with P1. Rings 2/3 open at P2/P3 (Phases 4/5). */
export function ringUnlocked(_state: GameState, ring: number): boolean {
  return ring === 1;
}

export function starChartUnlocked(state: GameState): boolean {
  return state.collapses > 0 || state.shardsEver.gt(ZERO);
}

export function canBuyNode(state: GameState, id: string): boolean {
  const def = nodeById.get(id);
  if (!def) return false;
  if (nodeActive(state, id)) return false;
  if (!ringUnlocked(state, def.ring)) return false;
  if (!def.requires.every((r) => nodeActive(state, r))) return false;
  return state.shards.gte(def.cost);
}

/** Buy (activate) a node. Mutates `state`; returns success. */
export function buyStarNode(state: GameState, id: string): boolean {
  if (!canBuyNode(state, id)) return false;
  const def = nodeById.get(id)!;
  state.shards = state.shards.sub(def.cost);
  state.starChart = { ...state.starChart, [id]: true };
  return true;
}

/** Shards currently invested in active nodes. */
export function starChartSpent(state: GameState): Decimal {
  let total = ZERO;
  for (const def of BAL.starChart) {
    if (nodeActive(state, def.id)) total = total.add(def.cost);
  }
  return total;
}

/** Deactivate everything and refund every spent Shard. */
export function respecStarChart(state: GameState): void {
  state.shards = state.shards.add(starChartSpent(state));
  state.starChart = {};
}

// ---------------------------------------------------------------------------
// Effect composition (read by multipliers.ts and friends)
// ---------------------------------------------------------------------------

function productOf(state: GameState, pick: (def: StarNodeDef) => Decimal | null): Decimal {
  let m = ONE;
  for (const def of BAL.starChart) {
    if (!nodeActive(state, def.id)) continue;
    const part = pick(def);
    if (part) m = m.mul(part);
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

export function starTapMult(state: GameState): Decimal {
  return productOf(state, (d) => (d.effect.kind === 'tap' ? d.effect.mult : null));
}

export function starSpeedMult(state: GameState): Decimal {
  return productOf(state, (d) => (d.effect.kind === 'speed' ? d.effect.mult : null));
}

export function starOfflineCapHours(state: GameState): number {
  let hours = 0;
  for (const def of BAL.starChart) {
    if (nodeActive(state, def.id) && def.effect.kind === 'offlineCapH') hours += def.effect.hours;
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
