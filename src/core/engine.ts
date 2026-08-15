/**
 * The simulation. `advance(state, dt)` is the single source of truth for the
 * running economy; every other function here is a player action.
 *
 * All functions are pure: they take a state and return a NEW state, never
 * mutating the input. That is what makes offline earnings, replay and (later)
 * server-side validation trivial.
 *
 * PURE MODULE — no React, no React Native, no services.
 */
import { newlyUnlocked } from './achievements';
import { Decimal, ZERO } from './numbers';
import {
  BOOST_DURATION_MS,
  BOOST_MULTIPLIER,
  BUSINESSES,
  SAVE_VERSION,
  STARTING_BUSINESS,
  STARTING_OWNED,
  getDef,
  getIndex,
} from './businesses';
import {
  buyCost,
  cappedOfflineSeconds,
  cycleRevenueFor,
  cycleTimeFor,
  getBusiness,
  globalMultiplier,
  managerCost,
  offlineCapSeconds,
  perSecond,
  prestigeGain,
  resolveBuyCount,
  unitCostMultiplier,
} from './economy';
import {
  availableInvestors,
  freshPerks,
  nextPerkCost,
  perkGoldenDurationMs,
  perkGoldenMultiplier,
  perkTapCycles,
} from './perks';
import { dayIndex, nextStreakDay, streakAvailable, streakReward } from './streak';
import type {
  AchievementId,
  AdvanceResult,
  BusinessId,
  BusinessState,
  BuyAmount,
  GameState,
  OfflineResult,
  Payout,
  PerkId,
  StreakResult,
} from './types';

/**
 * Cycle-completion tolerance. Accumulating `dt / cycleTime` over many 100ms
 * ticks lands a hair under 1.0 in floating point; without this a cycle would
 * occasionally take one extra tick. The overpay is ~1e-9 of a cycle.
 */
const CYCLE_EPSILON = 1e-9;

// ---------------------------------------------------------------------------
// State construction
// ---------------------------------------------------------------------------

function freshBusinesses(): BusinessState[] {
  return BUSINESSES.map((def) => ({
    id: def.id,
    owned: def.id === STARTING_BUSINESS ? STARTING_OWNED : 0,
    progress: 0,
    managed: false,
    active: false,
  }));
}

/** A brand-new save: one Fry Shack owned, nothing else. */
export function createInitialState(now: number = Date.now()): GameState {
  return {
    version: SAVE_VERSION,
    cash: ZERO,
    lifetimeEarnings: ZERO,
    investors: 0,
    perks: freshPerks(),
    businesses: freshBusinesses(),
    buyAmount: 1,
    boostRemainingMs: 0,
    boostMultiplier: BOOST_MULTIPLIER,
    prestigeCount: 0,
    totalTaps: 0,
    streakDays: 0,
    // Deliberately not "today": a brand-new player should be offered day 1 on
    // their very first launch, not on their second.
    lastStreakDay: 0,
    unlocked: [],
    startedAt: now,
    lastActiveAt: now,
  };
}

/** Shallow copy that never shares the businesses array with the input. */
function cloneState(state: GameState, businesses?: BusinessState[]): GameState {
  return {
    ...state,
    businesses: businesses ?? state.businesses.map((bs) => ({ ...bs })),
  };
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

const EMPTY_RESULT = (state: GameState): AdvanceResult => ({ state, earned: ZERO, payouts: [] });

/**
 * Advance the simulation by `dtSeconds`.
 *
 * - Managed businesses are computed analytically (`cycles = floor(progress + dt/cycleTime)`),
 *   so ANY dt is safe — a 100ms tick and a 4-hour catch-up take the same path.
 * - A manually tapped business pays at most one cycle, then stops.
 * - If the boost expires inside the step, the step is split at the expiry so the
 *   boosted and un-boosted portions are both paid correctly.
 */
export function advance(state: GameState, dtSeconds: number): AdvanceResult {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return EMPTY_RESULT(state);

  const boostSeconds = state.boostRemainingMs / 1000;
  if (state.boostRemainingMs > 0 && dtSeconds > boostSeconds) {
    const boosted = advanceSlice(state, boostSeconds);
    const rest = advanceSlice(boosted.state, dtSeconds - boostSeconds);
    return mergeResults(boosted, rest);
  }
  return advanceSlice(state, dtSeconds);
}

function advanceSlice(state: GameState, dtSeconds: number): AdvanceResult {
  const globalMult = globalMultiplier(state);
  // One manual cycle pays this many cycles' worth — the `tap` perk. Computed
  // once per step rather than per business: it is a global figure.
  const tapCycles = perkTapCycles(state);
  const payouts: Payout[] = [];
  let earned = ZERO;

  const businesses = state.businesses.map((bs, i) => {
    const def = BUSINESSES[i];
    // Identity is preserved for anything that cannot change this step: React
    // rows subscribe per business, so a new object here is a wasted re-render.
    if (bs.owned <= 0) return bs;
    if (!bs.managed && !bs.active) return bs;

    // Effective cycle time, not `def.cycleTime`: speed milestones shorten it,
    // and the income maths in economy.ts reads the same helper.
    const total = bs.progress + dtSeconds / cycleTimeFor(def, bs.owned);

    if (bs.managed) {
      const cycles = Math.floor(total + CYCLE_EPSILON);
      if (cycles > 0) {
        const amount = cycleRevenueFor(def, bs.owned, globalMult).mul(cycles);
        earned = earned.add(amount);
        payouts.push({ id: bs.id, cycles, amount });
      }
      return { ...bs, progress: Math.max(0, total - cycles) };
    }

    // Manually tapped: pay one cycle (or `tapCycles` of them, with the perk),
    // then go idle. The bar still runs once — the perk makes a tap worth more,
    // not faster, so the animation stays honest.
    if (total + CYCLE_EPSILON >= 1) {
      const amount = cycleRevenueFor(def, bs.owned, globalMult).mul(tapCycles);
      earned = earned.add(amount);
      payouts.push({ id: bs.id, cycles: tapCycles, amount });
      return { ...bs, progress: 0, active: false };
    }
    return { ...bs, progress: total };
  });

  const next = cloneState(state, businesses);
  next.cash = state.cash.add(earned);
  next.lifetimeEarnings = state.lifetimeEarnings.add(earned);
  next.boostRemainingMs = Math.max(0, state.boostRemainingMs - dtSeconds * 1000);
  if (next.boostRemainingMs === 0) next.boostMultiplier = BOOST_MULTIPLIER;

  return { state: next, earned, payouts };
}

function mergeResults(a: AdvanceResult, b: AdvanceResult): AdvanceResult {
  const payouts: Payout[] = a.payouts.map((p) => ({ ...p }));
  for (const p of b.payouts) {
    const existing = payouts.find((x) => x.id === p.id);
    if (existing) {
      existing.cycles += p.cycles;
      existing.amount = existing.amount.add(p.amount);
    } else {
      payouts.push({ ...p });
    }
  }
  return { state: b.state, earned: a.earned.add(b.earned), payouts };
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

/**
 * Start one manual cycle on an un-automated business.
 * No-op if it is unowned, already running, or automated.
 */
export function tap(state: GameState, id: BusinessId): GameState {
  const bs = getBusiness(state, id);
  if (bs.owned <= 0 || bs.managed || bs.active) return state;

  const next = cloneState(state);
  const target = next.businesses[getIndex(id)];
  target.active = true;
  target.progress = 0;
  next.totalTaps = state.totalTaps + 1;
  return next;
}

/**
 * Buy units of a business using the given amount (defaults to the buy toggle).
 * Returns the state unchanged when the purchase is not affordable — the UI
 * disables the button in that case, this is the safety net.
 */
export function buy(state: GameState, id: BusinessId, amount?: BuyAmount): GameState {
  const count = resolveBuyCount(state, id, amount);
  if (count <= 0) return state;

  const bs = getBusiness(state, id);
  const cost = buyCost(getDef(id), bs.owned, count, unitCostMultiplier(state));
  if (state.cash.lt(cost)) return state;

  const next = cloneState(state);
  next.cash = state.cash.sub(cost);
  next.businesses[getIndex(id)].owned = bs.owned + count;
  return next;
}

/** Hire a manager: permanent automation. No-op if unaffordable or already hired. */
export function hireManager(state: GameState, id: BusinessId): GameState {
  const bs = getBusiness(state, id);
  if (bs.managed) return state;

  const cost = managerCost(state, id);
  if (state.cash.lt(cost)) return state;

  const next = cloneState(state);
  next.cash = state.cash.sub(cost);
  const target = next.businesses[getIndex(id)];
  target.managed = true;
  target.active = false;
  return next;
}

/** Switch the ×1/×10/×100/MAX toggle. */
export function setBuyAmount(state: GameState, amount: BuyAmount): GameState {
  if (state.buyAmount === amount) return state;
  return { ...cloneState(state), buyAmount: amount };
}

/**
 * Sell the empire: bank investors, wipe cash and businesses, keep everything
 * permanent. `lifetimeEarnings` persists — it is what the investor total is
 * derived from — and so does the whole perk tree, which is where the permanent
 * power now lives. No-op unless at least one investor would be gained.
 */
export function prestige(state: GameState): GameState {
  const gained = prestigeGain(state);
  if (gained < 1) return state;

  return {
    ...state,
    cash: ZERO,
    investors: state.investors + gained,
    // Perks are deliberately carried over untouched: they are the reason to
    // prestige, so resetting them would make the button pointless.
    perks: { ...state.perks },
    businesses: freshBusinesses(),
    boostRemainingMs: 0,
    boostMultiplier: BOOST_MULTIPLIER,
    prestigeCount: state.prestigeCount + 1,
  };
}

/**
 * Spend investors on one level of a perk.
 *
 * No-op when the perk is maxed or the player cannot afford it — the UI disables
 * the button in both cases, this is the safety net. Levels are the only thing
 * investors can be spent on, so `availableInvestors` is the complete check.
 */
export function buyPerk(state: GameState, id: PerkId): GameState {
  const cost = nextPerkCost(state, id);
  if (cost === null) return state;
  if (availableInvestors(state) < cost) return state;

  return {
    ...cloneState(state),
    perks: { ...state.perks, [id]: (state.perks[id] ?? 0) + 1 },
  };
}

/**
 * Start (or extend) a temporary profit boost. Duration stacks; the strongest
 * multiplier wins, so a golden frietzak never gets downgraded by an ad boost.
 */
export function activateBoost(
  state: GameState,
  durationMs: number = BOOST_DURATION_MS,
  multiplier: number = BOOST_MULTIPLIER,
): GameState {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return state;
  const active = state.boostRemainingMs > 0;
  return {
    ...cloneState(state),
    boostRemainingMs: (active ? state.boostRemainingMs : 0) + durationMs,
    boostMultiplier: active ? Math.max(state.boostMultiplier, multiplier) : multiplier,
  };
}

/**
 * Golden frietzak ✨ — the same boost system with a stronger multiplier, which
 * the `golden` perk raises further (and lengthens).
 */
export function activateGoldenBoost(state: GameState): GameState {
  return activateBoost(state, perkGoldenDurationMs(state), perkGoldenMultiplier(state));
}

/** Add money (offline collect, time-skip reward, cash lump). Also credits lifetime. */
export function collect(state: GameState, amount: Decimal): GameState {
  if (amount.lte(ZERO)) return state;
  return {
    ...cloneState(state),
    cash: state.cash.add(amount),
    lifetimeEarnings: state.lifetimeEarnings.add(amount),
  };
}

// ---------------------------------------------------------------------------
// Offline
// ---------------------------------------------------------------------------

/**
 * Earnings for time spent away: `perSecond * min(elapsed, cap)`, where the cap
 * is 12h plus whatever the `offline` perk adds.
 *
 * Exact rather than approximate: owned counts cannot change while the player is
 * away, so the income rate is constant over the whole window.
 */
export function offlineEarnings(state: GameState, elapsedSeconds: number): OfflineResult {
  const rawSeconds = Number.isFinite(elapsedSeconds) && elapsedSeconds > 0 ? elapsedSeconds : 0;
  const seconds = cappedOfflineSeconds(rawSeconds, offlineCapSeconds(state));
  return {
    seconds,
    rawSeconds,
    capped: rawSeconds > seconds,
    amount: perSecond(state).mul(seconds),
  };
}

/** Offline earnings since `state.lastActiveAt`. */
export function offlineEarningsSince(state: GameState, now: number = Date.now()): OfflineResult {
  return offlineEarnings(state, (now - state.lastActiveAt) / 1000);
}

/**
 * Bank offline earnings. `multiplier` is 2 when the player watches the rewarded
 * "double it" ad. Also advances `lastActiveAt` so the window is not paid twice.
 */
export function applyOffline(
  state: GameState,
  result: OfflineResult,
  multiplier = 1,
  now: number = Date.now(),
): GameState {
  const next = collect(state, result.amount.mul(multiplier));
  return { ...(next === state ? cloneState(state) : next), lastActiveAt: now };
}

/** Record that the app is going to the background. */
export function touch(state: GameState, now: number = Date.now()): GameState {
  return { ...cloneState(state), lastActiveAt: now };
}

// ---------------------------------------------------------------------------
// Daily streak
// ---------------------------------------------------------------------------

/**
 * Claim today's streak. Returns the same state and a null result when today has
 * already been claimed, so calling it on every launch is safe.
 *
 * The claim is recorded before the reward is paid, which is the order that
 * matters: if anything downstream fails, the player has lost a reward, not
 * gained an infinitely repeatable one.
 */
export function claimStreak(
  state: GameState,
  now: number = Date.now(),
): { state: GameState; result: StreakResult | null } {
  if (!streakAvailable(state, now)) return { state, result: null };

  const day = nextStreakDay(state, now);
  const reward = streakReward(state, day);

  const claimed: GameState = {
    ...cloneState(state),
    streakDays: day,
    lastStreakDay: dayIndex(now),
  };

  return {
    state: collect(claimed, reward),
    result: { day, restarted: day === 1 && state.streakDays > 0, reward },
  };
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

/**
 * Bank any achievements the state now qualifies for.
 *
 * Returns the **same state object** when nothing unlocked. That identity is
 * load-bearing: this runs on every tick, and the store relies on it to avoid
 * re-rendering the tree ten times a second for nothing.
 */
export function settleAchievements(state: GameState): {
  state: GameState;
  unlocked: readonly AchievementId[];
} {
  const unlocked = newlyUnlocked(state);
  if (unlocked.length === 0) return { state, unlocked };

  return {
    state: { ...cloneState(state), unlocked: [...state.unlocked, ...unlocked] },
    unlocked,
  };
}
