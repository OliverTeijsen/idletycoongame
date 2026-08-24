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

  // P3 — Converge
  aeon: Dec;
  bestAeon: Dec;
  aeonEver: Dec;
  converges: number;
  aeonTree: Record<string, boolean>;

  // Minerals & Research
  ore: Dec;
  miners: Record<string, number>; // minerId -> bought
  research: Record<string, boolean>; // survives Converge; resets at Unify

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

  // Achievements: id -> earned. Never reset by anything.
  achievements: Record<string, boolean>;
  /** Transient toast queue for newly earned achievements — not saved. */
  pendingAchievements: string[];

  // Star Chart: nodeId -> active
  starChart: Record<string, boolean>;

  // Automation: autobuyer id -> enabled. Missing id = ON (default-on).
  automation: Record<string, boolean>;
  /** Seconds since the last autobuyer pass. Transient — not saved. */
  autobuyTimer: number;

  options: GameOptions;
}

export type BuyAmount = 1 | 10 | 'MAX';
