/**
 * Minerals & Research (spec §8.3), unlocked at P3.
 *
 * Miners are bought with Spark and produce Ore continuously. Research nodes
 * are Ore purchases — a one-time list plus an ENDLESS grid — and survive
 * Converge.
 *
 * WHAT CHANGED, AND WHY MINING USED TO BE POINTLESS
 * -------------------------------------------------
 * Three things were wrong at once, and each on its own was enough to kill the
 * lane:
 *
 *  1. Ore and miners reset at every Converge — roughly hourly — so the
 *     "permanent, slow, compounding backbone" the spec describes never
 *     compounded. They now survive Converge and reset only at Unify (and not
 *     even then, with Buried Fleet).
 *  2. Ore only ever bought a FINITE list of eight research nodes, so past the
 *     first evening every miner you bought produced a currency with nowhere
 *     to spend it. `researchGrid` is the endless lane; Deep Refinement is on
 *     the critical path to Unify.
 *  3. Nothing about mining touched production directly. `oreMult` in
 *     multipliers.ts now pays (1 + oreEver)^0.30 on everything, forever.
 *
 * Ore stays the slowest number in the game on purpose — miner COUNT is
 * logarithmic in Spark, so Ore measures how long you have played rather than
 * how big your last run was. That is the lane's job.
 */
import { BAL, MinerDef, ResearchDef } from '../balance';
import { D, Decimal, ONE, ZERO, clean, cleanMul } from '../numbers';
import { GameState } from '../types';
import { elementOreMult } from './elements';
import { smithMult } from './managers';
import { starOreMult } from './starchart';
import { gridMult, upgradeCost } from './upgrades';

export function mineralsUnlocked(state: GameState): boolean {
  return state.converges > 0;
}

const minerDefs = new Map(BAL.miners.map((m) => [m.id, m]));
const researchDefs = new Map(BAL.research.map((r) => [r.id, r]));
const researchGridDefs = new Map(BAL.researchGrid.map((r) => [r.id, r]));

export function minerDef(id: string): MinerDef | undefined {
  return minerDefs.get(id);
}

export function researchDef(id: string): ResearchDef | undefined {
  return researchDefs.get(id);
}

export function minerCount(state: GameState, id: string): number {
  return state.miners[id] ?? 0;
}

/** Core Sample research divides every miner price by a thousand. */
function minerCostDivisor(state: GameState): Decimal {
  return state.research['coreSample'] ? D(1e3) : ONE;
}

export function minerCost(state: GameState, id: string): Decimal {
  const def = minerDefs.get(id)!;
  return def.baseCost.mul(def.costGrowth.pow(minerCount(state, id))).div(minerCostDivisor(state));
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

/**
 * Every multiplier on Ore gain: research (one-time ×2/×3 and the endless Ore
 * Engine), the Terra element, the Deep Vein star node, the Refine prism
 * upgrade and the Smith manager.
 *
 * Five separate lanes feed Ore on purpose. Mining is the one system every
 * other layer can invest INTO, which is what makes "push Collapses to
 * accelerate mining" a real routing decision rather than a slogan.
 */
export function oreMultipliers(state: GameState): Decimal {
  let m = ONE;
  if (state.research['oreSluice']) m = m.mul(2);
  if (state.research['oreVein']) m = m.mul(3);
  m = m.mul(gridMult(BAL.researchGrid, state.researchGrid, 'oreEngine'));
  m = m.mul(gridMult(BAL.prismGrid, state.prismGrid, 'refine'));
  m = m.mul(starOreMult(state));
  m = m.mul(elementOreMult(state));
  m = m.mul(smithMult(state));
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
  return clean(base.mul(oreMultipliers(state)));
}

/** Advance Ore accrual. Mutates `state`. */
export function tickMinerals(state: GameState, dt: number): void {
  const gained = oreRate(state).mul(dt);
  if (gained.lte(ZERO)) return;
  state.ore = clean(state.ore.add(gained));
  state.oreEver = clean(state.oreEver.add(gained));
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

// ---------------------------------------------------------------------------
// Repeatable research — Ore's endless lane
// ---------------------------------------------------------------------------

export function researchGridLevel(state: GameState, id: string): number {
  return state.researchGrid[id] ?? 0;
}

export function researchGridCost(state: GameState, id: string): Decimal {
  const def = researchGridDefs.get(id)!;
  return upgradeCost(def, researchGridLevel(state, id));
}

/** Buy one level of a repeatable research upgrade. Returns success. */
export function buyResearchGrid(state: GameState, id: string): boolean {
  if (!mineralsUnlocked(state)) return false;
  const def = researchGridDefs.get(id);
  if (!def) return false;
  const level = researchGridLevel(state, id);
  if (def.maxLevel !== null && level >= def.maxLevel) return false;
  const cost = upgradeCost(def, level);
  if (state.ore.lt(cost)) return false;
  state.ore = state.ore.sub(cost);
  state.researchGrid = { ...state.researchGrid, [id]: level + 1 };
  return true;
}
