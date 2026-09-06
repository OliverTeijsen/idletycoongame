/**
 * Time Flux (spec §8.6): offline time beyond the cap banks as Flux ⧗ once
 * P3 is reached. Flux buys a Time Warp (×2 sim speed) or a Spark Flux Boost
 * (×3 Spark). Both are timed in REAL seconds and tick down inside the game
 * loop, so clock changes can't stretch them.
 *
 * Leaf module: balance/numbers/types only.
 */
import { BAL } from '../balance';
import { Decimal, ONE, ZERO, clean } from '../numbers';
import { GameState } from '../types';

export function timeFluxUnlocked(state: GameState): boolean {
  return state.converges > 0;
}

/** Flux earned from offline seconds beyond the cap. */
export function fluxFromOverflow(state: GameState, overflowSeconds: number): Decimal {
  if (!timeFluxUnlocked(state) || overflowSeconds <= 0) return ZERO;
  return clean(BAL.timeflux.fluxPerOverflowMinute.mul(Math.floor(overflowSeconds / 60)));
}

/**
 * The slow ONLINE Flux trickle, once P3 is reached.
 *
 * Flux used to come only from offline overflow, which meant a player who never
 * closes the app never earned any — a strange property for a system that owns
 * a third of the Mine tab. The trickle is a fifth of the offline rate, so
 * going away is still much the better way to bank it.
 */
export function tickOnlineFlux(state: GameState, dt: number): void {
  if (!timeFluxUnlocked(state)) return;
  const gained = BAL.timeflux.fluxPerOnlineMinute.mul(dt / 60);
  if (gained.lte(ZERO)) return;
  state.flux = clean(state.flux.add(gained));
}

/** Sim-speed factor for this tick (warp active or not). */
export function warpFactor(state: GameState): number {
  return state.warpRemaining > 0 ? BAL.timeflux.warp.mult : 1;
}

/** Spark multiplier from an active Flux Boost. */
export function fluxBoostMult(state: GameState): Decimal {
  return state.boostRemaining > 0 ? BAL.timeflux.boost.mult : ONE;
}

/** Start (extend) a Time Warp if affordable. Returns success. */
export function startWarp(state: GameState): boolean {
  if (!timeFluxUnlocked(state)) return false;
  if (state.flux.lt(BAL.timeflux.warp.cost)) return false;
  state.flux = state.flux.sub(BAL.timeflux.warp.cost);
  state.warpRemaining += BAL.timeflux.warp.seconds;
  return true;
}

/** Start (extend) a Spark Flux Boost if affordable. Returns success. */
export function startFluxBoost(state: GameState): boolean {
  if (!timeFluxUnlocked(state)) return false;
  if (state.flux.lt(BAL.timeflux.boost.cost)) return false;
  state.flux = state.flux.sub(BAL.timeflux.boost.cost);
  state.boostRemaining += BAL.timeflux.boost.seconds;
  return true;
}

/** Deplete the timers by real elapsed seconds. Called from tick(). */
export function tickTimers(state: GameState, realDt: number): void {
  if (state.warpRemaining > 0) state.warpRemaining = Math.max(0, state.warpRemaining - realDt);
  if (state.boostRemaining > 0) state.boostRemaining = Math.max(0, state.boostRemaining - realDt);
  if (state.rewardBoostRemaining > 0) {
    state.rewardBoostRemaining = Math.max(0, state.rewardBoostRemaining - realDt);
  }
}

// ---------------------------------------------------------------------------
// Rewarded boost (spec §15) — granted by the ad service, owned by the core
// ---------------------------------------------------------------------------

/**
 * Grant the rewarded production boost. Extends an active one rather than
 * replacing it, so a second reward is never wasted. Available at any layer —
 * unlike Flux, this is not gated on P3.
 */
export function grantRewardBoost(state: GameState): void {
  state.rewardBoostRemaining += BAL.rewards.production.seconds;
}

/** Global multiplier from an active rewarded boost. */
export function rewardBoostMult(state: GameState): Decimal {
  return state.rewardBoostRemaining > 0 ? BAL.rewards.production.mult : ONE;
}
