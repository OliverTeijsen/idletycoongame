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

  // Star Chart: nodeId -> active
  starChart: Record<string, boolean>;

  // Automation: autobuyer id -> enabled. Missing id = ON (default-on).
  automation: Record<string, boolean>;
  /** Seconds since the last autobuyer pass. Transient — not saved. */
  autobuyTimer: number;

  options: GameOptions;
}

export type BuyAmount = 1 | 10 | 'MAX';
