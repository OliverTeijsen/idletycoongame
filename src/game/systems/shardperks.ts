/**
 * Shard-upgrade effect helpers (P1's own tree, spec §7).
 *
 * Split out of prestige.ts so dimensions.ts can read Ember Bank without a
 * dimensions → prestige → dimensions import cycle. Pure functions of state.
 */
import { BAL } from '../balance';
import { D, Decimal, ZERO } from '../numbers';
import { GameState } from '../types';

export function shardUpgradeLevel(state: GameState, id: string): number {
  return state.shardUpgrades[id] ?? 0;
}

/** Spark a fresh run starts with: 0 at level 0, then 100·10^(level−1). */
export function emberStartSpark(state: GameState): Decimal {
  const level = shardUpgradeLevel(state, 'emberBank');
  if (level <= 0) return ZERO;
  return D(100).mul(D(10).pow(level - 1));
}

/** Fraction of Motes kept on Collapse (0..1). */
export function moteKeepFraction(state: GameState): number {
  return Math.min(1, shardUpgradeLevel(state, 'moteEcho') * 0.2);
}

/** Dimension Boosts kept on Collapse. */
export function keptDimBoosts(state: GameState): number {
  return Math.min(state.dimBoosts, shardUpgradeLevel(state, 'boostEcho'));
}

/** Seconds between passes: Swift Servos, Overclock research and the Warden halve it. */
export function autobuyInterval(state: GameState): number {
  let interval = BAL.automation.baseInterval / Math.pow(2, shardUpgradeLevel(state, 'swiftServos'));
  if (state.research['fastServos']) interval /= 2;
  if (state.boostSlots.includes('warden')) interval /= 2;
  return interval;
}
