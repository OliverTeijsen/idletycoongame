import { BAL } from '../balance';
import { tick } from '../loop';
import { D, ONE, ZERO } from '../numbers';
import { applyOffline, offlineCapSeconds } from '../offline';
import { defaultState } from '../state';
import { ACHIEVEMENTS } from '../systems/achievements';
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
    // 20 minutes of overflow at 1/min, plus the online trickle the simulated
    // capped hours paid. The summary reports the whole move, and it must equal
    // the balance — otherwise the modal disagrees with the Mine tab.
    expect(summary.fluxGained.toNumber()).toBeGreaterThan(20);
    expect(s.flux.eq(summary.fluxGained)).toBe(true);
  });

  /**
   * Flux used to arrive only from offline overflow, which meant a player who
   * never closes the app never saw the system at all — a strange property for
   * a feature that owns a third of the Mine tab.
   */
  it('a slow trickle also arrives while you play, but only after P3', () => {
    const locked = defaultState(0);
    tick(locked, 600);
    expect(locked.flux.eq(ZERO)).toBe(true);

    const s = p3();
    tick(s, 600);
    expect(s.flux.sub(BAL.timeflux.fluxPerOnlineMinute.mul(10)).abs().lt(D(1e-6))).toBe(true);
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
    // Pre-earn every achievement on both so neither picks up an achievement
    // multiplier the other lacks mid-run (the warped state would otherwise
    // earn "Fast Forward" and out-produce by an extra 1%).
    for (const s of [warped, plain]) {
      for (const def of ACHIEVEMENTS) s.achievements[def.id] = true;
    }
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
    /*
     * Managers are big multipliers against a scarce number of slots — that IS
     * the design. A x1.5 everyone eventually owns all of is not a choice, it
     * is a formality, so these are x5 / x4 / x3 with one base slot.
     */
    expect(kindlerMult(s).toNumber()).toBe(5);
    expect(weaverMult(s).toNumber()).toBe(4);
    expect(wardenSpeed(s)).toBe(2);
    expect(seerCapMult(s)).toBe(1);
    expect(sparkMult(s).gte(D(5))).toBe(true); // kindler reaches sparkMult

    // seer raises the offline cap
    const cap = offlineCapSeconds(s);
    toggleManager(s, 'warden');
    toggleManager(s, 'seer');
    expect(offlineCapSeconds(s)).toBeCloseTo(cap * 2, 6);
  });
});
