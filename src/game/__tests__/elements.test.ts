import { BAL } from '../balance';
import { D, ONE } from '../numbers';
import { defaultState } from '../state';
import {
  allocateElement,
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
    expect(elementSparkMult(s).sub(D(1.1)).abs().lt(D(1e-9))).toBe(true);
    expect(elementMoteMult(s).sub(D(1.1)).abs().lt(D(1e-9))).toBe(true);
    expect(elementSpeedMult(s).sub(D(1.1)).abs().lt(D(1e-9))).toBe(true);
    expect(elementGlobalMult(s).sub(D(1.05)).abs().lt(D(1e-9))).toBe(true);
  });

  it('capstone at 10 points grants the extra global', () => {
    const s = unlocked();
    s.elements = { points: 0, alloc: { ignis: 10 }, progress: 0 };
    // no lux allocated, so global = capstone alone
    expect(elementGlobalMult(s).sub(BAL.elements.capstoneMult).abs().lt(D(1e-9))).toBe(true);
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
