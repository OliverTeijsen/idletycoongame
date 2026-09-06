/**
 * Fresh-game state. Every field a save can be missing falls back to these
 * values (spec §14 anti-corruption).
 */
import { ZERO } from './numbers';
import { freshDims } from './systems/dimensions';
import { GameState } from './types';

export const CURRENT_VERSION = 8;

export function defaultState(now: number = Date.now()): GameState {
  return {
    version: CURRENT_VERSION,
    savedAt: now,
    startedAt: now,
    timePlayed: 0,

    spark: ZERO,
    bestSparkRun: ZERO,
    totalSpark: ZERO,
    runSeconds: 0,
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
    bestCollapseGain: ZERO,

    prism: ZERO,
    bestPrism: ZERO,
    prismEver: ZERO,
    ascends: 0,
    prismGrid: {},

    elements: { points: 0, alloc: {}, progress: 0 },

    challenges: {},
    activeChallenge: null,
    challengeElapsed: 0,

    aeon: ZERO,
    bestAeon: ZERO,
    aeonEver: ZERO,
    converges: 0,
    aeonTree: {},
    aeonGrid: {},

    ore: ZERO,
    oreEver: ZERO,
    miners: {},
    research: {},
    researchGrid: {},

    flux: ZERO,
    warpRemaining: 0,
    boostRemaining: 0,
    rewardBoostRemaining: 0,

    boostSlots: [],

    singularity: ZERO,
    singularityEver: ZERO,
    unifies: 0,
    metaShop: {},
    metaGrid: {},

    achievements: {},
    pendingAchievements: [],

    starChart: {},

    automation: {},
    autobuyTimer: 0,

    milestones: {},

    options: {
      notation: 'standard',
      reducedMotion: false,
      confirmResets: true,
      muted: false,
      volume: 0.7,
      showOfflineSummary: true,
    },
  };
}
