/**
 * Elements / Spectrum (spec §8.2): five elements, a shared point pool, free
 * respec. Points come from Ascends, challenge completions and a slow passive
 * trickle. Terra stays locked until Minerals exist (P3).
 */
import { BAL, ElementId } from '../balance';
import { Decimal, ONE, cleanMul } from '../numbers';
import { GameState } from '../types';

export function elementsUnlocked(state: GameState): boolean {
  return state.ascends > 0;
}

export function elementAlloc(state: GameState, id: ElementId): number {
  return state.elements.alloc[id] ?? 0;
}

export function elementAllocatable(state: GameState, id: ElementId): boolean {
  const def = BAL.elements.defs.find((d) => d.id === id);
  if (!def) return false;
  // Terra (the `locked` def) waits for Minerals — it boosts Ore, which only
  // exists from Converge onward.
  if (def.locked && state.converges === 0) return false;
  return elementsUnlocked(state) && state.elements.points >= 1;
}

/** Move one point from the pool into an element. Returns success. */
export function allocateElement(state: GameState, id: ElementId): boolean {
  if (!elementAllocatable(state, id)) return false;
  state.elements = {
    ...state.elements,
    points: state.elements.points - 1,
    alloc: { ...state.elements.alloc, [id]: elementAlloc(state, id) + 1 },
  };
  return true;
}

/** Return every allocated point to the pool. */
export function respecElements(state: GameState): void {
  const spent = Object.values(state.elements.alloc).reduce((a, b) => a + b, 0);
  state.elements = { ...state.elements, points: state.elements.points + spent, alloc: {} };
}

/** Passive trickle: one point per passiveSeconds of play once unlocked. */
export function tickElements(state: GameState, dt: number): void {
  if (!elementsUnlocked(state)) return;
  let progress = state.elements.progress + dt;
  let points = state.elements.points;
  while (progress >= BAL.elements.passiveSeconds) {
    progress -= BAL.elements.passiveSeconds;
    points += 1;
  }
  if (points !== state.elements.points || progress !== state.elements.progress) {
    state.elements = { ...state.elements, points, progress };
  }
}

// ---------------------------------------------------------------------------
// Effect composition
// ---------------------------------------------------------------------------

function perPointMult(state: GameState, id: ElementId): Decimal {
  const alloc = elementAlloc(state, id);
  if (alloc <= 0) return ONE;
  return cleanMul(BAL.elements.perPoint[id].pow(alloc));
}

export function elementSparkMult(state: GameState): Decimal {
  return perPointMult(state, 'ignis');
}

export function elementMoteMult(state: GameState): Decimal {
  return perPointMult(state, 'aqua');
}

export function elementSpeedMult(state: GameState): Decimal {
  return perPointMult(state, 'aer');
}

export function elementOreMult(state: GameState): Decimal {
  return perPointMult(state, 'terra');
}

/** Lux per-point global × one capstone bonus per element at ≥ capstoneAt. */
export function elementGlobalMult(state: GameState): Decimal {
  let m = perPointMult(state, 'lux');
  for (const def of BAL.elements.defs) {
    if (elementAlloc(state, def.id) >= BAL.elements.capstoneAt) {
      m = m.mul(BAL.elements.capstoneMult);
    }
  }
  return cleanMul(m);
}
