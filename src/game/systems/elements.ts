/**
 * Elements / Spectrum (spec §8.2): five elements, a shared point pool, free
 * respec. Points come from Ascends, challenge completions and a slow passive
 * trickle. Terra stays locked until Minerals exist (P3).
 */
import { BAL, ElementId } from '../balance';
import { D, Decimal, ONE, cleanMul } from '../numbers';
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

/**
 * Effective allocation: softcapped in POINTS, not in the multiplier.
 *
 * Points arrive at a fixed rate forever (2 per Ascend, 2 per Trial tier, one
 * every 40 minutes of play), so an uncapped 1.12^points is an exponential in
 * wall-clock time — the one curve shape §7 forbids, and over a month it would
 * end up being the only number in the game that mattered. Capping the exponent
 * keeps Elements a major lane while making the marginal point worth most in an
 * element you have NOT yet filled, which is what makes free respec a decision.
 */
export function effectiveAlloc(state: GameState, id: ElementId): number {
  const alloc = elementAlloc(state, id);
  const { t, p } = BAL.softcap.element;
  return alloc <= t ? alloc : t * Math.pow(alloc / t, p);
}

function perPointMult(state: GameState, id: ElementId): Decimal {
  const alloc = effectiveAlloc(state, id);
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

/**
 * Lux per-point global × every capstone step cleared, in every element.
 *
 * Capstones are TIERED (10/25/50/100 points in one element) rather than a
 * single threshold: one flat ×1.2 at ten points is a bonus you clear on the
 * second Ascend and never think about again, which is precisely the dead-buff
 * shape this rebalance exists to remove.
 *
 * THEY PULL AGAINST THE SOFTCAP ON PURPOSE. `effectiveAlloc` above makes the
 * marginal point worth most in an element you have not filled (spread wide);
 * capstones pay for going deep in one. The two together are what make the
 * allocation an actual decision instead of an obvious one — and the second
 * capstone sits exactly on the softcap knee, which is where the argument is
 * closest.
 */
export function elementCapstones(state: GameState, id: ElementId): number {
  const alloc = elementAlloc(state, id);
  return BAL.elements.capstones.filter((c) => alloc >= c).length;
}

export function elementGlobalMult(state: GameState): Decimal {
  let m = perPointMult(state, 'lux');
  let steps = 0;
  for (const def of BAL.elements.defs) steps += elementCapstones(state, def.id);
  if (steps > 0) m = m.mul(D(BAL.elements.capstoneMult).pow(steps));
  return cleanMul(m);
}
