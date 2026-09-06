/**
 * GameState shape (spec §16), Phases 0–2 subset.
 *
 * Later phases ADD fields; the save loader fills missing fields from
 * `defaultState()` so old saves keep working (spec §14).
 *
 * PURE MODULE — no React, no React Native.
 */
import { Decimal } from './numbers';

export type Dec = Decimal;

export interface DimensionTier {
  /** Purchases made this reset — drives cost. Plain number by design (§4). */
  bought: number;
  /** Total owned incl. amounts produced by the tier above. */
  amount: Dec;
  /** Revealed to the player (startingTiers + one per Dimension Boost). */
  unlocked: boolean;
}

export type NotationMode = 'standard' | 'scientific' | 'engineering';

export interface GameOptions {
  notation: NotationMode;
  reducedMotion: boolean;
  confirmResets: boolean;
  muted: boolean;
  /** 0..1. */
  volume: number;
  /** Show the "while you were away" summary on resume. */
  showOfflineSummary: boolean;
}

export interface GameState {
  version: number;
  savedAt: number;
  startedAt: number;
  /** Seconds of simulated play (incl. offline grants). */
  timePlayed: number;

  // Layer 0
  spark: Dec;
  bestSparkRun: Dec;
  totalSpark: Dec;
  /** Seconds since the last Layer-0 reset — the current run's age. */
  runSeconds: number;
  dims: DimensionTier[]; // length 8
  sparkUpgrades: Record<string, number>;
  dimBoosts: number;
  totalTaps: number;

  // Motes
  motes: Dec;
  motesEver: Dec;
  moteUpgrades: Record<string, number>;

  // P1 — Collapse
  shards: Dec;
  bestShards: Dec;
  shardsEver: Dec;
  collapses: number;
  shardUpgrades: Record<string, number>;
  /** Best single Collapse gain THIS cycle. Resets with shardsEver. */
  bestCollapseGain: Dec;

  // P2 — Ascend
  prism: Dec;
  bestPrism: Dec;
  prismEver: Dec;
  ascends: number;
  prismGrid: Record<string, number>;

  // Elements (points/alloc are counts by design, §4)
  elements: {
    points: number;
    alloc: Record<string, number>;
    /** Seconds accrued toward the next passive point. */
    progress: number;
  };

  // Challenges: id -> tiers completed
  challenges: Record<string, number>;
  activeChallenge: string | null;
  /** Seconds spent in the current Trial run — the abandon-if-hopeless clock. */
  challengeElapsed: number;

  // P3 — Converge
  aeon: Dec;
  bestAeon: Dec;
  aeonEver: Dec;
  converges: number;
  aeonTree: Record<string, boolean>;
  aeonGrid: Record<string, number>; // repeatable Aeon upgrades

  // Minerals & Research
  ore: Dec;
  /** Ore earned this Unify cycle. Drives the Ore global multiplier (§8.3). */
  oreEver: Dec;
  miners: Record<string, number>; // minerId -> bought
  research: Record<string, boolean>; // survives Converge; resets at Unify
  researchGrid: Record<string, number>; // repeatable Ore upgrades

  // Time Flux
  flux: Dec;
  /** Real seconds of ×2 warp left. Sim-relative, so clock changes can't cheat. */
  warpRemaining: number;
  /** Real seconds of the Spark flux-boost left. */
  boostRemaining: number;
  /** Real seconds of the rewarded ×2 production boost left (spec §15). */
  rewardBoostRemaining: number;

  // Boost Managers: assigned ids, at most slot count
  boostSlots: string[];

  // P4 — Unify
  singularity: Dec;
  singularityEver: Dec;
  unifies: number;
  metaShop: Record<string, boolean>;
  metaGrid: Record<string, number>; // repeatable Singularity upgrades

  // Achievements: id -> earned. Never reset by anything.
  achievements: Record<string, boolean>;
  /** Transient toast queue for newly earned achievements — not saved. */
  pendingAchievements: string[];

  // Star Chart: nodeId -> RANK (0/missing = not bought). Ranked since the
  // Phase 12 rebalance — see BAL.starChart for why a switch was not enough.
  starChart: Record<string, number>;

  // Automation: autobuyer id -> enabled. Missing id = ON (default-on).
  automation: Record<string, boolean>;
  /** Seconds since the last autobuyer pass. Transient — not saved. */
  autobuyTimer: number;

  /**
   * Speedrun splits: milestone id -> `timePlayed` when it was first reached.
   * Never reset by any prestige layer — a route is only comparable against
   * another route if the clock survives the resets it is measuring.
   */
  milestones: Record<string, number>;

  options: GameOptions;
}

export type BuyAmount = 1 | 10 | 'MAX';
