/**
 * Streak calendar rules. Dates are the only hard part of this feature, so they
 * get their own suite — midnight, missed days and daylight saving included.
 */
import { STREAK_MAX_DAYS, STREAK_MIN_REWARD, STREAK_SECONDS_PER_DAY } from '../businesses';
import { claimStreak, createInitialState } from '../engine';
import { D } from '../numbers';
import { dayIndex, nextStreakDay, streakAvailable, streakReward } from '../streak';
import type { GameState } from '../types';

/** Local-midnight timestamp for a calendar date, which is what a player sees. */
function localDate(year: number, month: number, day: number, hour = 12): number {
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime();
}

function stateOn(day: number, streakDays: number): GameState {
  return { ...createInitialState(0), streakDays, lastStreakDay: day };
}

describe('dayIndex', () => {
  it('is stable across a single local day', () => {
    const morning = dayIndex(localDate(2026, 3, 14, 0));
    const night = dayIndex(localDate(2026, 3, 14, 23));
    expect(morning).toBe(night);
  });

  it('advances by exactly one at local midnight', () => {
    const today = dayIndex(localDate(2026, 3, 14, 23));
    const tomorrow = dayIndex(localDate(2026, 3, 15, 0));
    expect(tomorrow - today).toBe(1);
  });

  it('advances by one across a month boundary', () => {
    expect(dayIndex(localDate(2026, 2, 1)) - dayIndex(localDate(2026, 1, 31))).toBe(1);
  });

  it('advances by one across a leap day', () => {
    expect(dayIndex(localDate(2024, 2, 29)) - dayIndex(localDate(2024, 2, 28))).toBe(1);
    expect(dayIndex(localDate(2024, 3, 1)) - dayIndex(localDate(2024, 2, 29))).toBe(1);
  });

  // A local day is 23 or 25 hours long around a DST switch. Building the index
  // from the local Y/M/D rather than from elapsed milliseconds is what keeps the
  // step at exactly one — and stops a streak breaking on the clock change.
  it('advances by one across a daylight-saving switch', () => {
    // Europe/Brussels springs forward on 2026-03-29 and back on 2026-10-25.
    expect(dayIndex(localDate(2026, 3, 29)) - dayIndex(localDate(2026, 3, 28))).toBe(1);
    expect(dayIndex(localDate(2026, 3, 30)) - dayIndex(localDate(2026, 3, 29))).toBe(1);
    expect(dayIndex(localDate(2026, 10, 25)) - dayIndex(localDate(2026, 10, 24))).toBe(1);
    expect(dayIndex(localDate(2026, 10, 26)) - dayIndex(localDate(2026, 10, 25))).toBe(1);
  });
});

describe('streakAvailable', () => {
  it('is true for a brand-new save, so day one lands on the first launch', () => {
    expect(streakAvailable(createInitialState(0), localDate(2026, 3, 14))).toBe(true);
  });

  it('is false once today is claimed, however often the app is reopened', () => {
    const now = localDate(2026, 3, 14, 9);
    const state = stateOn(dayIndex(now), 1);
    expect(streakAvailable(state, now)).toBe(false);
    expect(streakAvailable(state, localDate(2026, 3, 14, 23))).toBe(false);
  });

  it('is true again the next day', () => {
    const state = stateOn(dayIndex(localDate(2026, 3, 14)), 1);
    expect(streakAvailable(state, localDate(2026, 3, 15))).toBe(true);
  });
});

describe('nextStreakDay', () => {
  it('continues the run when the last claim was yesterday', () => {
    const state = stateOn(dayIndex(localDate(2026, 3, 14)), 4);
    expect(nextStreakDay(state, localDate(2026, 3, 15))).toBe(5);
  });

  it('restarts at one when a day was missed', () => {
    const state = stateOn(dayIndex(localDate(2026, 3, 14)), 4);
    expect(nextStreakDay(state, localDate(2026, 3, 16))).toBe(1);
  });

  it('restarts at one after a long absence', () => {
    const state = stateOn(dayIndex(localDate(2026, 1, 1)), 30);
    expect(nextStreakDay(state, localDate(2026, 3, 14))).toBe(1);
  });

  it('starts at one for a fresh save', () => {
    expect(nextStreakDay(createInitialState(0), localDate(2026, 3, 14))).toBe(1);
  });
});

describe('streakReward', () => {
  it('never pays zero, even with no income at all', () => {
    const reward = streakReward(createInitialState(0), 1);
    expect(reward.gte(D(STREAK_MIN_REWARD))).toBe(true);
  });

  it('scales with the day', () => {
    const state = createInitialState(0);
    expect(streakReward(state, 3).gt(streakReward(state, 1))).toBe(true);
  });

  it('stops growing past the cap, so a 90-day run is a badge not a jackpot', () => {
    const state = createInitialState(0);
    const atCap = streakReward(state, STREAK_MAX_DAYS);
    expect(streakReward(state, STREAK_MAX_DAYS + 50).eq(atCap)).toBe(true);
  });

  it('pays a slice of current income once the player has any', () => {
    const base = createInitialState(0);
    const earning: GameState = {
      ...base,
      businesses: base.businesses.map((b) =>
        b.id === 'friet' ? { ...b, owned: 100, managed: true } : b,
      ),
    };
    // Well above the floor now, and proportional to the day.
    expect(streakReward(earning, 2).gt(D(STREAK_MIN_REWARD * 2))).toBe(true);
    expect(streakReward(earning, 1).gt(D(STREAK_SECONDS_PER_DAY))).toBe(true);
  });
});

describe('claimStreak', () => {
  it('pays the reward and records the day', () => {
    const now = localDate(2026, 3, 14);
    const { state, result } = claimStreak(createInitialState(0), now);

    expect(result).not.toBeNull();
    expect(result?.day).toBe(1);
    expect(state.streakDays).toBe(1);
    expect(state.lastStreakDay).toBe(dayIndex(now));
    expect(state.cash.eq(result!.reward)).toBe(true);
  });

  it('credits lifetime earnings too, so the reward counts toward prestige', () => {
    const now = localDate(2026, 3, 14);
    const { state, result } = claimStreak(createInitialState(0), now);
    expect(state.lifetimeEarnings.eq(result!.reward)).toBe(true);
  });

  // The whole point of storing a day index: reopening the app must not pay again.
  it('is a no-op the second time in one day, and returns the same object', () => {
    const now = localDate(2026, 3, 14);
    const first = claimStreak(createInitialState(0), now);
    const second = claimStreak(first.state, localDate(2026, 3, 14, 23));

    expect(second.result).toBeNull();
    expect(second.state).toBe(first.state);
  });

  it('flags a restart after a missed day', () => {
    const day1 = claimStreak(createInitialState(0), localDate(2026, 3, 14));
    const day3 = claimStreak(day1.state, localDate(2026, 3, 16));

    expect(day3.result?.day).toBe(1);
    expect(day3.result?.restarted).toBe(true);
  });

  it('does not flag a restart on the very first claim', () => {
    const first = claimStreak(createInitialState(0), localDate(2026, 3, 14));
    expect(first.result?.restarted).toBe(false);
  });

  it('counts consecutive days up', () => {
    let state = createInitialState(0);
    for (let day = 14; day <= 20; day++) {
      state = claimStreak(state, localDate(2026, 3, day)).state;
    }
    expect(state.streakDays).toBe(7);
  });

  it('never mutates the input', () => {
    const before = createInitialState(0);
    const snapshot = { ...before };
    claimStreak(before, localDate(2026, 3, 14));
    expect(before.streakDays).toBe(snapshot.streakDays);
    expect(before.lastStreakDay).toBe(snapshot.lastStreakDay);
    expect(before.cash.eq(snapshot.cash)).toBe(true);
  });
});
