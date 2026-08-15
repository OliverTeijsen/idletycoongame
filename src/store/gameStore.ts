/**
 * Zustand store: the single bridge between the pure core and React.
 *
 * NO GAME LOGIC LIVES HERE. Every action delegates to `src/core/engine`, takes
 * the returned state and stores it. The store's own job is only: hydration,
 * autosave, the offline hand-off, and payout events for the juice layer.
 */
import { create } from 'zustand';

import { BOOST_DURATION_MS, BOOST_MULTIPLIER } from '../core/businesses';
import {
  activateBoost,
  activateGoldenBoost,
  advance,
  applyOffline,
  buy,
  buyPerk,
  buyUpgrade,
  claimStreak,
  createInitialState,
  hireManager,
  offlineEarningsSince,
  prestige,
  setBuyAmount,
  settleAchievements,
  tap,
  touch,
} from '../core/engine';
import type {
  AchievementId,
  BusinessId,
  BuyAmount,
  GameState,
  OfflineResult,
  Payout,
  PerkId,
  StreakResult,
} from '../core/types';
import { loadGame, saveGame } from '../services/storage';

/** Autosave cadence, in simulated seconds. */
export const AUTOSAVE_SECONDS = 5;

/** Below this, "welcome back" is noise rather than a reward. */
export const MIN_OFFLINE_SECONDS = 5;

/**
 * Safety clamp for a single tick. The AppState handler is what pays for long
 * absences (as offline earnings); this only catches a dropped frame or a timer
 * that fired late, and stops a paused-JS gap from being paid twice.
 */
export const MAX_TICK_SECONDS = 60;

// ---------------------------------------------------------------------------
// Payout events
//
// Coin bursts and floating "+€X" fire many times a second. Routing them through
// component state would re-render the tree for a purely visual effect, so they
// are delivered to subscribers directly and never stored.
// ---------------------------------------------------------------------------

type PayoutListener = (payouts: Payout[]) => void;

const payoutListeners = new Set<PayoutListener>();

export function subscribeToPayouts(listener: PayoutListener): () => void {
  payoutListeners.add(listener);
  return () => {
    payoutListeners.delete(listener);
  };
}

function emitPayouts(payouts: Payout[]): void {
  if (payouts.length === 0) return;
  payoutListeners.forEach((listener) => listener(payouts));
}

// Achievement unlocks ride the same channel pattern: rare, but they arrive from
// the tick loop rather than from a user action, and the toast that shows them
// is pure presentation.

type UnlockListener = (ids: readonly AchievementId[]) => void;

const unlockListeners = new Set<UnlockListener>();

export function subscribeToUnlocks(listener: UnlockListener): () => void {
  unlockListeners.add(listener);
  return () => {
    unlockListeners.delete(listener);
  };
}

function emitUnlocks(ids: readonly AchievementId[]): void {
  if (ids.length === 0) return;
  unlockListeners.forEach((listener) => listener(ids));
}

/**
 * Bank any achievements earned by `state`, announcing the new ones.
 *
 * Returns the SAME object when nothing unlocked, which is what lets every
 * caller pass the result straight to `set()` without a diff.
 */
function withAchievements(state: GameState): GameState {
  const settled = settleAchievements(state);
  emitUnlocks(settled.unlocked);
  return settled.state;
}

// ---------------------------------------------------------------------------

export interface GameStore {
  state: GameState;
  /** True once a save has been loaded (or a new game created). */
  hydrated: boolean;
  /** Pending "welcome back" payout, shown by OfflineModal. */
  offline: OfflineResult | null;
  /** Pending daily-streak reward, shown by StreakModal. */
  streak: StreakResult | null;
  /** Set while PrestigeModal is confirming. */
  prestigePending: boolean;
  /** Set while the achievements list is open. */
  achievementsOpen: boolean;
  /** Set while the investor skill tree is open. */
  perksOpen: boolean;

  hydrate: (now?: number) => void;
  tick: (dtSeconds: number) => void;

  tapBusiness: (id: BusinessId) => void;
  buyBusiness: (id: BusinessId) => void;
  hireManagerFor: (id: BusinessId) => void;
  /** Buy one cash upgrade for a tier. No-op when unaffordable or unowned. */
  buyUpgradeFor: (id: BusinessId) => void;
  chooseBuyAmount: (amount: BuyAmount) => void;

  startBoost: (durationMs?: number, multiplier?: number) => void;
  /** The golden frietzak's reward — a bigger multiplier than the ad boost. */
  startGoldenBoost: () => void;

  openPrestige: () => void;
  closePrestige: () => void;
  confirmPrestige: () => void;

  openAchievements: () => void;
  closeAchievements: () => void;

  openPerks: () => void;
  closePerks: () => void;
  /** Spend investors on one level of a perk. No-op when unaffordable or maxed. */
  buyPerkLevel: (id: PerkId) => void;

  claimOffline: (multiplier?: number, now?: number) => void;
  /** Dismiss the streak modal. The reward was already banked when it opened. */
  dismissStreak: () => void;

  save: (now?: number) => void;
  onBackground: (now?: number) => void;
  onForeground: (now?: number) => void;

  /** Wipe everything and start over. Used by tests and a debug menu. */
  resetGame: (now?: number) => void;
}

/** Seconds of simulation since the last write. */
let sinceSave = 0;

/** Compute the pending offline payout, or null when it is not worth a modal. */
function pendingOffline(state: GameState, now: number): OfflineResult | null {
  const result = offlineEarningsSince(state, now);
  if (result.rawSeconds < MIN_OFFLINE_SECONDS) return null;
  if (result.amount.lte(0)) return null;
  return result;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: createInitialState(),
  hydrated: false,
  offline: null,
  streak: null,
  prestigePending: false,
  achievementsOpen: false,
  perksOpen: false,

  hydrate: (now = Date.now()) => {
    const loaded = loadGame(now);
    const offline = loaded ? pendingOffline(loaded, now) : null;
    sinceSave = 0;

    // Re-anchor immediately: the pending payout has already been computed, so
    // the ticking that starts now must not be counted a second time.
    const anchored = touch(loaded ?? createInitialState(now), now);

    // The streak is claimed here, on load, rather than when the modal is
    // dismissed. A player who force-quits mid-modal keeps the reward instead of
    // being offered it again — and the save below makes that survive.
    const claimed = claimStreak(anchored, now);
    if (claimed.result) saveGame(claimed.state);

    // Achievements are deliberately NOT settled here. `AchievementToast` only
    // mounts once `hydrated` flips true, which is after this runs — an unlock
    // announced now would be shouted into an empty room and never shown again,
    // because the next check would find it already banked. The first tick is
    // 100ms away and does it with the toast listening.
    set({
      state: claimed.state,
      offline,
      streak: claimed.result,
      hydrated: true,
    });
  },

  tick: (dtSeconds) => {
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
    const dt = Math.min(dtSeconds, MAX_TICK_SECONDS);

    const result = advance(get().state, dt);
    emitPayouts(result.payouts);

    // Achievements are settled here so that the passive ones (lifetime earnings,
    // a streak crossing midnight) unlock while the player watches, not only
    // after their next tap. `settleAchievements` returns the same object when
    // nothing changed, so the common case costs a comparison.
    const earned = withAchievements(result.state);

    sinceSave += dt;
    if (sinceSave >= AUTOSAVE_SECONDS) {
      sinceSave = 0;
      const stamped = touch(earned, Date.now());
      saveGame(stamped);
      set({ state: stamped });
      return;
    }
    set({ state: earned });
  },

  tapBusiness: (id) => set({ state: withAchievements(tap(get().state, id)) }),
  buyBusiness: (id) => set({ state: withAchievements(buy(get().state, id)) }),
  hireManagerFor: (id) => set({ state: withAchievements(hireManager(get().state, id)) }),
  buyUpgradeFor: (id) => set({ state: withAchievements(buyUpgrade(get().state, id)) }),
  chooseBuyAmount: (amount) => set({ state: setBuyAmount(get().state, amount) }),

  startBoost: (durationMs = BOOST_DURATION_MS, multiplier = BOOST_MULTIPLIER) =>
    set({ state: activateBoost(get().state, durationMs, multiplier) }),

  startGoldenBoost: () => set({ state: activateGoldenBoost(get().state) }),

  openPrestige: () => set({ prestigePending: true }),
  closePrestige: () => set({ prestigePending: false }),
  confirmPrestige: () => {
    const before = get().state;
    const next = withAchievements(prestige(before));
    saveGame(next);
    sinceSave = 0;
    // Land straight in the skill tree with the investors just earned. Prestige
    // felt empty precisely because its reward was a number that changed
    // somewhere off-screen; handing the player the spend screen is the moment
    // the loop pays off, so it should not have to be gone looking for.
    set({ state: next, prestigePending: false, perksOpen: next !== before });
  },

  openAchievements: () => set({ achievementsOpen: true }),
  closeAchievements: () => set({ achievementsOpen: false }),

  openPerks: () => set({ perksOpen: true }),
  closePerks: () => set({ perksOpen: false }),
  // Saved immediately rather than on the next autosave tick: spending a
  // prestige currency is the one purchase a player would be furious to lose.
  buyPerkLevel: (id) => {
    const next = withAchievements(buyPerk(get().state, id));
    if (next === get().state) return;
    saveGame(next);
    sinceSave = 0;
    set({ state: next });
  },

  claimOffline: (multiplier = 1, now = Date.now()) => {
    const { offline, state } = get();
    if (!offline) return;
    const next = withAchievements(applyOffline(state, offline, multiplier, now));
    saveGame(next);
    sinceSave = 0;
    set({ state: next, offline: null });
  },

  dismissStreak: () => set({ streak: null }),

  save: (now = Date.now()) => {
    const stamped = touch(get().state, now);
    saveGame(stamped);
    sinceSave = 0;
    set({ state: stamped });
  },

  onBackground: (now = Date.now()) => {
    get().save(now);
  },

  onForeground: (now = Date.now()) => {
    const { state } = get();
    const offline = pendingOffline(state, now);
    sinceSave = 0;

    // The streak is claimed here as well as on hydrate. A phone left in a pocket
    // overnight never relaunches the app, so claiming only on hydrate would skip
    // the day for anyone who leaves it running. `claimStreak` is a no-op when
    // today is already banked, which makes calling it on every resume safe.
    const claimed = claimStreak(touch(state, now), now);
    if (claimed.result) saveGame(claimed.state);

    set({
      state: withAchievements(claimed.state),
      offline: offline ?? get().offline,
      streak: claimed.result ?? get().streak,
    });
  },

  resetGame: (now = Date.now()) => {
    const fresh = createInitialState(now);
    saveGame(fresh);
    sinceSave = 0;
    set({
      state: fresh,
      offline: null,
      streak: null,
      prestigePending: false,
      achievementsOpen: false,
      perksOpen: false,
      hydrated: true,
    });
  },
}));
