/**
 * Daily streak: the calendar rules, kept apart from the engine because the only
 * hard part here is dates, and dates deserve their own tests.
 *
 * PURE MODULE — no React, no React Native, no services.
 */
import { STREAK_MAX_DAYS, STREAK_MIN_REWARD, STREAK_SECONDS_PER_DAY } from './businesses';
import { perSecond } from './economy';
import { D, Decimal } from './numbers';
import type { GameState } from './types';

const MS_PER_DAY = 86_400_000;

/**
 * The player's **local** calendar day, as a whole number of days.
 *
 * Local, not UTC: "did I play yesterday?" is a question about the player's own
 * calendar, and a UTC boundary would break the streak at 01:00 for anyone east
 * of Greenwich. Building the index through `Date.UTC` from the local Y/M/D is
 * what makes the arithmetic immune to daylight saving — a local day is not
 * always 24 hours long, but the index still advances by exactly one.
 */
export function dayIndex(epochMs: number): number {
  const d = new Date(epochMs);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_PER_DAY);
}

/** True when today's streak has not been claimed yet. */
export function streakAvailable(state: GameState, now: number = Date.now()): boolean {
  return dayIndex(now) !== state.lastStreakDay;
}

/**
 * The streak the player would be on if they claimed now.
 *
 * Yesterday continues the run; anything older restarts it at day 1. A claim
 * made twice in one day is not a claim, so callers must check
 * `streakAvailable()` first — this answers "what if", not "what now".
 */
export function nextStreakDay(state: GameState, now: number = Date.now()): number {
  return dayIndex(now) - state.lastStreakDay === 1 ? state.streakDays + 1 : 1;
}

/**
 * Reward for landing on day `day`.
 *
 * A slice of the player's *current* income rather than a flat sum, so it stays
 * worth collecting at every stage. It grows to a cap at `STREAK_MAX_DAYS` and
 * then holds: a 90-day streak is a badge, not a runaway multiplier.
 */
export function streakReward(state: GameState, day: number): Decimal {
  const days = Math.min(Math.max(1, day), STREAK_MAX_DAYS);
  const earned = perSecond(state).mul(days * STREAK_SECONDS_PER_DAY);
  const floor = D(STREAK_MIN_REWARD * days);
  return earned.gt(floor) ? earned : floor;
}
