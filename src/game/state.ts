/**
 * Fresh-game state. Every field a save can be missing falls back to these
 * values (spec §14 anti-corruption).
 */
import { ZERO } from './numbers';
import { freshDims } from './systems/dimensions';
import { GameState } from './types';

export const CURRENT_VERSION = 1;

export function defaultState(now: number = Date.now()): GameState {
  return {
    version: CURRENT_VERSION,
    savedAt: now,
    startedAt: now,
    timePlayed: 0,

    spark: ZERO,
    bestSparkRun: ZERO,
    totalSpark: ZERO,
    dims: freshDims(),
    sparkUpgrades: {},
    dimBoosts: 0,
    totalTaps: 0,

    motes: ZERO,
    motesEver: ZERO,
    moteUpgrades: {},

    options: {
      notation: 'standard',
      reducedMotion: false,
      confirmResets: true,
    },
  };
}
