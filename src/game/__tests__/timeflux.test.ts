import { BAL } from '../balance';
import { tick } from '../loop';
import { D, ONE, ZERO } from '../numbers';
import { applyOffline, offlineCapSeconds } from '../offline';
import { defaultState } from '../state';
import { kindlerMult, seerCapMult, toggleManager, wardenSpeed, weaverMult } from '../systems/managers';
import { sparkMult } from '../systems/multipliers';
import { fluxFromOverflow, startFluxBoost, startWarp } from '../systems/timeflux';

function p3() {
  const s = defaultState(0);
  s.converges = 1;
  return s;
}

describe('flux banking', () => {
  it('overflow converts only after P3', () => {
    const locked = defaultState(0);
    expect(fluxFromOverflow(locked, 3600).eq(ZERO)).toBe(true);
    const s = p3();
    expect(fluxFromOverflow(s, 3600).toNumber()).toBe(60);
  });

  it('applyOffline banks the overflow as flux', () => {
    const s = p3();
    s.dims[0].amount = D(10);
    const cap = offlineCapSeconds(s);
    const summary = applyOffline(s, cap + 1200)!;
    expect(summary.fluxGained.toNumber()).toBe(20);
    expect(s.flux.toNumber()).toBe(20);
  });
});

describe('warp & boost', () => {
  it('warp costs flux and doubles simulated production per real second', () => {
    const s = p3();
    s.flux = BAL.timeflux.warp.cost;
    expect(startWarp(s)).toBe(true);
    expect(s.flux.eq(ZERO)).toBe(true);
    expect(s.warpRemaining).toBe(BAL.timeflux.warp.seconds);

    const warped = p3();
    warped.dims[0].amount = D(100);
    warped.warpRemaining = 100;
    const plain = p3();
    plain.dims[0].amount = D(100);
    for (let i = 0; i < 20; i++) {
      tick(warped, 1 / 20);
      tick(plain, 1 / 20);
    }
    expect(warped.spark.div(plain.spark).sub(D(BAL.timeflux.warp.mult)).abs().lt(D(1e-6))).toBe(true);
    // one real second consumed one second of warp
    expect(warped.warpRemaining).toBeCloseTo(99, 6);
  });

  it('flux boost multiplies spark and expires', () => {
    const s = p3();
    s.flux = BAL.timeflux.boost.cost;
    expect(startFluxBoost(s)).toBe(true);
    expect(sparkMult(s).eq(BAL.timeflux.boost.mult)).toBe(true);
    s.boostRemaining = 0.04;
    tick(s, 1 / 20);
    expect(s.boostRemaining).toBeLessThanOrEqual(0);
    expect(sparkMult(s).eq(ONE)).toBe(true);
  });

  it('cannot start without flux or before P3', () => {
    const s = p3();
    expect(startWarp(s)).toBe(false);
    const locked = defaultState(0);
    locked.flux = D(1e6);
    expect(startWarp(locked)).toBe(false);
  });
});

describe('boost managers', () => {
  it('assignment respects the slot limit', () => {
    const s = p3();
    expect(toggleManager(s, 'kindler')).toBe(true);
    expect(toggleManager(s, 'weaver')).toBe(false); // 1 slot by default
    s.research = { slotA: true };
    expect(toggleManager(s, 'weaver')).toBe(true);
    // unassign frees the slot
    expect(toggleManager(s, 'kindler')).toBe(true);
    expect(s.boostSlots).toEqual(['weaver']);
    expect(toggleManager(s, 'nonsense')).toBe(false);
  });

  it('locked before P3', () => {
    const s = defaultState(0);
    expect(toggleManager(s, 'kindler')).toBe(false);
  });

  it('manager effects land on their targets', () => {
    const s = p3();
    s.research = { slotA: true, slotB: true };
    toggleManager(s, 'kindler');
    toggleManager(s, 'weaver');
    toggleManager(s, 'warden');
    expect(kindlerMult(s).toNumber()).toBe(2);
    expect(weaverMult(s).toNumber()).toBe(1.5);
    expect(wardenSpeed(s)).toBe(2);
    expect(seerCapMult(s)).toBe(1);
    expect(sparkMult(s).gte(D(2))).toBe(true); // kindler reaches sparkMult

    // seer raises the offline cap
    const cap = offlineCapSeconds(s);
    toggleManager(s, 'warden');
    toggleManager(s, 'seer');
    expect(offlineCapSeconds(s)).toBeCloseTo(cap * 1.5, 6);
  });
});
