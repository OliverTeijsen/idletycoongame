/**
 * Fresh-game state. Every field a save can be missing falls back to these
 * values (spec §14 anti-corruption).
 */
import { ZERO } from './numbers';
import { freshDims } from './systems/dimensions';
import { GameState } from './types';

export const CURRENT_VERSION = 5;

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

    shards: ZERO,
    bestShards: ZERO,
    shardsEver: ZERO,
    collapses: 0,
    shardUpgrades: {},

    prism: ZERO,
    bestPrism: ZERO,
    prismEver: ZERO,
    ascends: 0,
    prismGrid: {},

    elements: { points: 0, alloc: {}, progress: 0 },

    challenges: {},
    activeChallenge: null,

    aeon: ZERO,
    bestAeon: ZERO,
    aeonEver: ZERO,
    converges: 0,
    aeonTree: {},

    ore: ZERO,
    miners: {},
    research: {},

    flux: ZERO,
    warpRemaining: 0,
    boostRemaining: 0,

    boostSlots: [],

    singularity: ZERO,
    singularityEver: ZERO,
    unifies: 0,
    metaShop: {},

    starChart: {},

    automation: {},
    autobuyTimer: 0,

    options: {
      notation: 'standard',
      reducedMotion: false,
      confirmResets: true,
    },
  };
}
