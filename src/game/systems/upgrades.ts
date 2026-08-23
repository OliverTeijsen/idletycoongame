/**
 * Generic repeatable-upgrade math + the Spark upgrade branch (spec §6.3).
 *
 * All repeatable upgrades share the same shape: geometric cost, a multiplier
 * per level. Composition of the resulting multipliers happens in the owning
 * system (dimensions, motes), not here.
 */
import { BAL, RepeatableUpgradeDef } from '../balance';
import { D, Decimal, ONE, cleanMul } from '../numbers';
import { GameState } from '../types';
import { starTapMult } from './starchart';

/** Cost of the next level of any geometric-cost upgrade. */
export function upgradeCost(
  def: { baseCost: Decimal; costGrowth: Decimal },
  level: number,
): Decimal {
  return def.baseCost.mul(def.costGrowth.pow(Math.max(0, level)));
}

export function upgradeMaxed(def: RepeatableUpgradeDef, level: number): boolean {
  return def.maxLevel !== null && level >= def.maxLevel;
}

/** effectPerLevel ^ level, safe for level 0. */
export function upgradeMult(def: RepeatableUpgradeDef, level: number): Decimal {
  if (level <= 0) return ONE;
  return cleanMul(def.effectPerLevel.pow(level));
}

const sparkDefs = new Map(BAL.sparkUpgrades.map((u) => [u.id, u]));

export function sparkUpgradeDef(id: string): RepeatableUpgradeDef | undefined {
  return sparkDefs.get(id);
}

export function sparkUpgradeLevel(state: GameState, id: string): number {
  return state.sparkUpgrades[id] ?? 0;
}

/**
 * Buy one level of a Spark upgrade if affordable. Mutates `state` in place;
 * returns true when a purchase happened.
 */
export function buySparkUpgrade(state: GameState, id: string): boolean {
  const def = sparkDefs.get(id);
  if (!def) return false;
  const level = sparkUpgradeLevel(state, id);
  if (upgradeMaxed(def, level)) return false;
  const cost = upgradeCost(def, level);
  if (state.spark.lt(cost)) return false;
  state.spark = state.spark.sub(cost);
  state.sparkUpgrades = { ...state.sparkUpgrades, [id]: level + 1 };
  return true;
}

/** Spark granted per tap: tapBase × Charge Coil × star nodes. */
export function tapPower(state: GameState): Decimal {
  const coil = sparkDefs.get('chargeCoil');
  const mult = coil ? upgradeMult(coil, sparkUpgradeLevel(state, 'chargeCoil')) : ONE;
  return D(BAL.tapBase).mul(mult).mul(starTapMult(state));
}
