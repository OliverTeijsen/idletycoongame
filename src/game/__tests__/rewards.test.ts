/**
 * Rewarded boosts (spec §15) and the sound throttle (§13). Both are pure, so
 * they belong in the `core` project with the economy.
 */
import { BAL } from '../balance';
import { tick } from '../loop';
import { D, ONE, ZERO } from '../numbers';
import { applyOffline, grantDoubleOffline } from '../offline';
import { deserializeState, serializeState } from '../save';
import { defaultState } from '../state';
import { globalMult } from '../systems/multipliers';
import { grantRewardBoost, rewardBoostMult } from '../systems/timeflux';
import { SoundThrottle } from '../../audio/throttle';

describe('rewarded production boost', () => {
  it('multiplies global production while it runs, then expires', () => {
    const s = defaultState(0);
    expect(rewardBoostMult(s).eq(ONE)).toBe(true);

    grantRewardBoost(s);
    expect(s.rewardBoostRemaining).toBe(BAL.rewards.production.seconds);
    expect(rewardBoostMult(s).eq(BAL.rewards.production.mult)).toBe(true);
    expect(globalMult(s).gte(BAL.rewards.production.mult)).toBe(true);

    s.rewardBoostRemaining = 0.04;
    tick(s, 1 / 20);
    expect(s.rewardBoostRemaining).toBe(0);
    expect(rewardBoostMult(s).eq(ONE)).toBe(true);
  });

  it('extends rather than replaces, so a second reward is never wasted', () => {
    const s = defaultState(0);
    grantRewardBoost(s);
    grantRewardBoost(s);
    expect(s.rewardBoostRemaining).toBe(BAL.rewards.production.seconds * 2);
  });

  it('counts down in REAL seconds even while a Time Warp speeds the sim', () => {
    const s = defaultState(0);
    s.converges = 1;
    grantRewardBoost(s);
    s.warpRemaining = 100;
    const before = s.rewardBoostRemaining;
    for (let i = 0; i < 20; i++) tick(s, 1 / 20); // one real second
    expect(before - s.rewardBoostRemaining).toBeCloseTo(1, 6);
  });

  it('survives a save roundtrip and is clamped against tampering', () => {
    const s = defaultState(0);
    grantRewardBoost(s);
    const back = deserializeState(serializeState(s), 0)!;
    expect(back.rewardBoostRemaining).toBe(BAL.rewards.production.seconds);

    const doc = JSON.parse(serializeState(s));
    doc.rewardBoostRemaining = 1e12; // a year of free boost
    expect(deserializeState(JSON.stringify(doc), 0)!.rewardBoostRemaining).toBe(86400);
  });
});

describe('rewarded double offline', () => {
  it('pays out exactly the same amount again — never compounding', () => {
    const s = defaultState(0);
    s.dims[0] = { bought: 1, amount: D(500), unlocked: true };
    const summary = applyOffline(s, 600)!;
    const afterFirst = s.spark;
    expect(summary.doubled).toBe(false);

    const doubled = grantDoubleOffline(s, summary);
    expect(doubled.doubled).toBe(true);
    // Total granted is exactly 2× the original grant.
    expect(doubled.sparkGained.sub(summary.sparkGained.mul(2)).abs().lt(D(1e-6))).toBe(true);
    expect(s.spark.sub(afterFirst.add(summary.sparkGained)).abs().lt(D(1e-6))).toBe(true);
  });

  it('doubles motes and ore too, and keeps lifetime totals honest', () => {
    const s = defaultState(0);
    s.converges = 1;
    s.dims[0] = { bought: 1, amount: D(400), unlocked: true };
    s.miners = { drill: 5 };
    const summary = applyOffline(s, 600)!;
    const motesEverBefore = s.motesEver;

    const doubled = grantDoubleOffline(s, summary);
    expect(doubled.motesGained.gt(summary.motesGained)).toBe(true);
    expect(doubled.oreGained.gt(summary.oreGained)).toBe(true);
    expect(s.motesEver.gt(motesEverBefore)).toBe(true);
  });

  it('an idle save doubles nothing and stays finite', () => {
    const s = defaultState(0);
    const summary = applyOffline(s, 3600)!;
    const doubled = grantDoubleOffline(s, summary);
    expect(doubled.sparkGained.eq(ZERO)).toBe(true);
    expect(Number.isNaN(s.spark.mantissa)).toBe(false);
  });
});

describe('sound throttle', () => {
  it('drops cues inside the gap and allows them after', () => {
    const t = new SoundThrottle(120);
    expect(t.allow('tick', 1000)).toBe(true);
    expect(t.allow('tick', 1050)).toBe(false);
    expect(t.allow('tick', 1119)).toBe(false);
    expect(t.allow('tick', 1121)).toBe(true);
  });

  it('throttles each cue independently', () => {
    const t = new SoundThrottle(120);
    expect(t.allow('tick', 0)).toBe(true);
    expect(t.allow('prestige', 0)).toBe(true); // different cue, not blocked
    expect(t.allow('tick', 10)).toBe(false);
  });

  it('a late-game pulse storm collapses to a steady trickle', () => {
    const t = new SoundThrottle(120);
    let played = 0;
    // 200 pulses across one simulated second.
    for (let i = 0; i < 200; i++) if (t.allow('tick', i * 5)) played += 1;
    expect(played).toBeLessThanOrEqual(9);
    expect(played).toBeGreaterThan(0);
  });
});
