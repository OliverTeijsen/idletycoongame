import { BAL } from '../balance';
import { D, ONE } from '../numbers';
import { defaultState } from '../state';
import {
  allocateElement,
  effectiveAlloc,
  elementGlobalMult,
  elementMoteMult,
  elementSparkMult,
  elementSpeedMult,
  elementsUnlocked,
  respecElements,
  tickElements,
} from '../systems/elements';

function unlocked() {
  const s = defaultState(0);
  s.ascends = 1;
  s.elements = { points: 5, alloc: {}, progress: 0 };
  return s;
}

describe('allocation', () => {
  it('locked before the first ascend', () => {
    const s = defaultState(0);
    s.elements.points = 5;
    expect(elementsUnlocked(s)).toBe(false);
    expect(allocateElement(s, 'ignis')).toBe(false);
  });

  it('moves points from the pool; refuses when empty', () => {
    const s = unlocked();
    expect(allocateElement(s, 'ignis')).toBe(true);
    expect(s.elements.points).toBe(4);
    expect(s.elements.alloc.ignis).toBe(1);
    s.elements.points = 0;
    expect(allocateElement(s, 'ignis')).toBe(false);
  });

  it('terra is locked until Converge', () => {
    const s = unlocked();
    expect(allocateElement(s, 'terra')).toBe(false);
  });

  it('respec returns everything to the pool', () => {
    const s = unlocked();
    allocateElement(s, 'ignis');
    allocateElement(s, 'aqua');
    respecElements(s);
    expect(s.elements.points).toBe(5);
    expect(s.elements.alloc).toEqual({});
  });
});

describe('effects', () => {
  it('per-point multipliers land on their targets', () => {
    const s = unlocked();
    allocateElement(s, 'ignis');
    allocateElement(s, 'aqua');
    allocateElement(s, 'aer');
    allocateElement(s, 'lux');
    const per = BAL.elements.perPoint;
    expect(elementSparkMult(s).sub(per.ignis).abs().lt(D(1e-9))).toBe(true);
    expect(elementMoteMult(s).sub(per.aqua).abs().lt(D(1e-9))).toBe(true);
    expect(elementSpeedMult(s).sub(per.aer).abs().lt(D(1e-9))).toBe(true);
    expect(elementGlobalMult(s).sub(per.lux).abs().lt(D(1e-9))).toBe(true);
  });

  it('capstones are tiered: each threshold cleared is another multiplier', () => {
    const s = unlocked();
    const [first, second] = BAL.elements.capstones;
    s.elements = { points: 0, alloc: { ignis: first }, progress: 0 };
    // no lux allocated, so global = capstones alone
    expect(elementGlobalMult(s).sub(BAL.elements.capstoneMult).abs().lt(D(1e-9))).toBe(true);
    s.elements = { points: 0, alloc: { ignis: second }, progress: 0 };
    expect(elementGlobalMult(s).sub(BAL.elements.capstoneMult.pow(2)).abs().lt(D(1e-9))).toBe(
      true,
    );
  });

  /**
   * Points arrive forever at a fixed rate, so an uncapped per-point multiplier
   * would be an exponential in wall-clock time. The cap is on the ALLOCATION,
   * which is also what makes a second affinity worth more than a deeper first.
   */
  it('allocation past the softcap knee counts for less', () => {
    const s = unlocked();
    const t = BAL.softcap.element.t;
    s.elements = { points: 0, alloc: { ignis: t }, progress: 0 };
    expect(effectiveAlloc(s, 'ignis')).toBeCloseTo(t, 6);
    s.elements = { points: 0, alloc: { ignis: t * 16 }, progress: 0 };
    expect(effectiveAlloc(s, 'ignis')).toBeLessThan(t * 16);
    expect(effectiveAlloc(s, 'ignis')).toBeGreaterThan(t);
  });
});

describe('passive trickle', () => {
  it('grants a point per passiveSeconds once unlocked, none before', () => {
    const locked = defaultState(0);
    tickElements(locked, BAL.elements.passiveSeconds * 2);
    expect(locked.elements.points).toBe(0);

    const s = unlocked();
    tickElements(s, BAL.elements.passiveSeconds + 5);
    expect(s.elements.points).toBe(6);
    expect(s.elements.progress).toBeCloseTo(5, 6);
  });
});
