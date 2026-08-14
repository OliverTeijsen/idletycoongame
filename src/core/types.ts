/**
 * Core domain types. PURE MODULE — no React, no React Native, no services.
 */
import type { Decimal } from './numbers';

export type BusinessId =
  | 'friet'
  | 'wafel'
  | 'choco'
  | 'cafe'
  | 'brouw'
  | 'resto'
  | 'truck'
  | 'super'
  | 'concern'
  | 'empire';

/** Static, immutable definition of a business tier (see §4 of the spec). */
export interface BusinessDef {
  readonly id: BusinessId;
  /**
   * Canonical English name. NOT what the UI renders — the core cannot import
   * the i18n layer, so display names live in `ui/i18n` keyed by id. This is the
   * fallback and the debug label.
   */
  readonly name: string;
  readonly icon: string;
  /** Cost of the first unit. Cost of unit n is baseCost * COST_MULTIPLIER^n. */
  readonly baseCost: Decimal;
  /** Revenue of one cycle, per owned unit, before milestone/global multipliers. */
  readonly baseRevenue: Decimal;
  /** Seconds for one full production cycle. */
  readonly cycleTime: number;
  /** One-time cost to automate this business. */
  readonly managerCost: Decimal;
}

/** Mutable per-run state of a business tier. */
export interface BusinessState {
  readonly id: BusinessId;
  /** Units owned. */
  owned: number;
  /** Cycle progress as a fraction in [0, 1). */
  progress: number;
  /** Manager hired — loops forever without tapping. */
  managed: boolean;
  /** A manually tapped cycle is currently running. Ignored while `managed`. */
  active: boolean;
}

/** Buy-multiplier toggle shown in the UI. */
export type BuyAmount = 1 | 10 | 100 | 'MAX';

export type AchievementId =
  | 'tap-100'
  | 'tap-1k'
  | 'tap-10k'
  | 'own-50'
  | 'own-250'
  | 'own-1000'
  | 'managers-5'
  | 'managers-all'
  | 'earn-1m'
  | 'earn-1t'
  | 'prestige-1'
  | 'prestige-10'
  | 'streak-3'
  | 'streak-7'
  | 'streak-30';

/**
 * An achievement is a threshold on a number read from the state. Keeping it to
 * `progress` + `goal` rather than a free-form predicate is what lets the UI show
 * a progress bar for every one of them without a special case.
 *
 * Names and descriptions are NOT here: they live in `ui/i18n`, keyed by id, for
 * the same reason business names do.
 */
export interface AchievementDef {
  readonly id: AchievementId;
  readonly icon: string;
  readonly goal: number;
  /** Current value, in the same unit as `goal`. */
  readonly progress: (state: GameState) => number;
}

/** The complete save-able game state. Everything the engine needs. */
export interface GameState {
  /** Save schema version, for migrations. */
  version: number;
  cash: Decimal;
  /** Total earned across *all* runs — never reset. Drives the prestige formula. */
  lifetimeEarnings: Decimal;
  /** Permanent prestige currency (investors 💼). */
  investors: number;
  /** Aligned by index with BUSINESSES. */
  businesses: BusinessState[];
  buyAmount: BuyAmount;
  /** Milliseconds left on the temporary profit boost. 0 = inactive. */
  boostRemainingMs: number;
  /** Multiplier applied while the boost is active (2 for the ad boost, 7 for golden frietzak). */
  boostMultiplier: number;
  /** Number of completed prestiges. */
  prestigeCount: number;
  /** Lifetime manual taps (stat / achievements). */
  totalTaps: number;
  /** Consecutive days played, including today once claimed. 0 = never claimed. */
  streakDays: number;
  /**
   * Local-calendar day index of the last claimed streak day, from `dayIndex()`.
   * A day index rather than a timestamp: comparing days is the whole question,
   * and storing the raw ms invites off-by-one bugs across midnight.
   */
  lastStreakDay: number;
  /** Achievements already earned. Order is unlock order. */
  unlocked: AchievementId[];
  /** Epoch ms of first launch. */
  startedAt: number;
  /** Epoch ms of the last save/background — the anchor for offline earnings. */
  lastActiveAt: number;
}

/** One business paying out during an `advance()` step. Drives coin-burst juice. */
export interface Payout {
  id: BusinessId;
  cycles: number;
  amount: Decimal;
}

/** Result of `advance()`: the new state plus what happened during the step. */
export interface AdvanceResult {
  state: GameState;
  earned: Decimal;
  payouts: Payout[];
}

/** Result of `claimStreak()` — what the "day N" modal shows. */
export interface StreakResult {
  /** The streak the player is now on, after this claim. */
  day: number;
  /** True when a missed day reset the run back to 1. */
  restarted: boolean;
  reward: Decimal;
}

/** Result of `offlineEarnings()`. */
export interface OfflineResult {
  /** Elapsed seconds after applying OFFLINE_CAP_SECONDS. */
  seconds: number;
  /** Raw elapsed seconds before the cap (for "you were away for X" copy). */
  rawSeconds: number;
  /** True when the cap trimmed the window. */
  capped: boolean;
  amount: Decimal;
}
