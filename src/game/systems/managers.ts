/**
 * Boost Managers (spec §8.7): assignable to limited slots — a real choice,
 * since slots are scarce. Leaf module (balance/numbers/types only) so the
 * multiplier stack and offline cap can read assignments without cycles.
 */
import { BAL } from '../balance';
import { Decimal, D, ONE } from '../numbers';
import { GameState } from '../types';

export function managersUnlocked(state: GameState): boolean {
  return state.converges > 0;
}

/** Total slots: base + Quarters research. */
export function managerSlots(state: GameState): number {
  let slots = BAL.managers.baseSlots;
  if (state.research['slotA']) slots += 1;
  if (state.research['slotB']) slots += 1;
  return slots;
}

export function managerAssigned(state: GameState, id: string): boolean {
  return state.boostSlots.includes(id);
}

/**
 * Toggle a manager in/out of the slots. Refuses to assign beyond the slot
 * count or unknown ids. Returns success.
 */
export function toggleManager(state: GameState, id: string): boolean {
  if (!managersUnlocked(state)) return false;
  if (!BAL.managers.defs.some((m) => m.id === id)) return false;
  if (managerAssigned(state, id)) {
    state.boostSlots = state.boostSlots.filter((m) => m !== id);
    return true;
  }
  if (state.boostSlots.length >= managerSlots(state)) return false;
  state.boostSlots = [...state.boostSlots, id];
  return true;
}

export function kindlerMult(state: GameState): Decimal {
  return managerAssigned(state, 'kindler') ? D(2) : ONE;
}

export function weaverMult(state: GameState): Decimal {
  return managerAssigned(state, 'weaver') ? D(1.5) : ONE;
}

/** Warden: autobuy interval divisor. */
export function wardenSpeed(state: GameState): number {
  return managerAssigned(state, 'warden') ? 2 : 1;
}

/** Seer: offline-cap multiplier. */
export function seerCapMult(state: GameState): number {
  return managerAssigned(state, 'seer') ? 1.5 : 1;
}
