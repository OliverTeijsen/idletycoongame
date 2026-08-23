/**
 * Minerals & Research (spec §8.3), unlocked at P3.
 *
 * Miners are bought with Spark and produce Ore continuously. Ore and miners
 * survive Collapse/Ascend and reset only at Converge/Unify. Research nodes
 * are one-time Ore purchases that SURVIVE Converge — the permanent, slow,
 * compounding backbone distinct from the fast prestige loop.
 */
import { BAL, MinerDef, ResearchDef } from '../balance';
import { D, Decimal, ONE, ZERO, clean, cleanMul } from '../numbers';
import { GameState } from '../types';
import { elementOreMult } from './elements';

export function mineralsUnlocked(state: GameState): boolean {
  return state.converges > 0;
}

const minerDefs = new Map(BAL.miners.map((m) => [m.id, m]));
const researchDefs = new Map(BAL.research.map((r) => [r.id, r]));

export function minerDef(id: string): MinerDef | undefined {
  return minerDefs.get(id);
}

export function researchDef(id: string): ResearchDef | undefined {
  return researchDefs.get(id);
}

export function minerCount(state: GameState, id: string): number {
  return state.miners[id] ?? 0;
}

export function minerCost(state: GameState, id: string): Decimal {
  const def = minerDefs.get(id)!;
  return def.baseCost.mul(def.costGrowth.pow(minerCount(state, id)));
}

/** Buy one miner with Spark. Returns success. */
export function buyMiner(state: GameState, id: string): boolean {
  if (!mineralsUnlocked(state)) return false;
  const def = minerDefs.get(id);
  if (!def) return false;
  const cost = minerCost(state, id);
  if (state.spark.lt(cost)) return false;
  state.spark = state.spark.sub(cost);
  state.miners = { ...state.miners, [id]: minerCount(state, id) + 1 };
  return true;
}

/** Research multiplier on Ore gain (Sluice ×2, Rich Veins ×3). */
function researchOreMult(state: GameState): Decimal {
  let m = ONE;
  if (state.research['oreSluice']) m = m.mul(2);
  if (state.research['oreVein']) m = m.mul(3);
  return cleanMul(m);
}

/** Ore per second across all miners. */
export function oreRate(state: GameState): Decimal {
  if (!mineralsUnlocked(state)) return ZERO;
  let base = ZERO;
  for (const def of BAL.miners) {
    const count = minerCount(state, def.id);
    if (count > 0) base = base.add(def.orePerSec.mul(count));
  }
  if (base.lte(ZERO)) return ZERO;
  return clean(base.mul(researchOreMult(state)).mul(elementOreMult(state)));
}

/** Advance Ore accrual. Mutates `state`. */
export function tickMinerals(state: GameState, dt: number): void {
  const gained = oreRate(state).mul(dt);
  if (gained.lte(ZERO)) return;
  state.ore = clean(state.ore.add(gained));
}

export function researchOwned(state: GameState, id: string): boolean {
  return state.research[id] === true;
}

/** Buy a one-time research node with Ore. Returns success. */
export function buyResearch(state: GameState, id: string): boolean {
  if (!mineralsUnlocked(state)) return false;
  const def = researchDefs.get(id);
  if (!def) return false;
  if (researchOwned(state, id)) return false;
  if (state.ore.lt(def.cost)) return false;
  state.ore = state.ore.sub(def.cost);
  state.research = { ...state.research, [id]: true };
  return true;
}

/** Research contribution to the global multiplier (Gyre Heart). */
export function researchGlobalMult(state: GameState): Decimal {
  return state.research['gyreHeart'] ? D(2) : ONE;
}
