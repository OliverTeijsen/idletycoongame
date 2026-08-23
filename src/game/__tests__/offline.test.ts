import { BAL } from '../balance';
import { D, ZERO } from '../numbers';
import { applyOffline, offlineCapSeconds } from '../offline';
import { defaultState } from '../state';
import { tick } from '../loop';

describe('offline progress', () => {
  it('grants roughly what live ticking would have', () => {
    const away = defaultState(0);
    away.dims[0].amount = D(100);
    const live = defaultState(0);
    live.dims[0].amount = D(100);

    const summary = applyOffline(away, 600)!;
    for (let i = 0; i < 600 * BAL.tickRate; i++) tick(live, 1 / BAL.tickRate);

    expect(summary).not.toBeNull();
    expect(summary.seconds).toBe(600);
    // chunked vs fine-grained: within 5% for a feedback-free single tier
    const diff = away.spark.sub(live.spark).abs().div(live.spark);
    expect(diff.lt(D(0.05))).toBe(true);
    expect(summary.sparkGained.eq(away.spark)).toBe(true);
  });

  it('caps elapsed time and reports the overflow', () => {
    const s = defaultState(0);
    s.dims[0].amount = D(10);
    const cap = offlineCapSeconds(s);
    const summary = applyOffline(s, cap + 5000)!;
    expect(summary.seconds).toBe(cap);
    expect(summary.overflowSeconds).toBe(5000);
  });

  it('negative and tiny elapsed grant nothing', () => {
    const s = defaultState(0);
    s.dims[0].amount = D(10);
    expect(applyOffline(s, -100)).toBeNull();
    expect(applyOffline(s, 5)).toBeNull();
    expect(s.spark.eq(ZERO)).toBe(true);
  });

  it('a fresh save (no producers) gains nothing but does not crash', () => {
    const s = defaultState(0);
    const summary = applyOffline(s, 3600)!;
    expect(summary.sparkGained.eq(ZERO)).toBe(true);
  });
});
