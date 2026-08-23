/**
 * Motes & Resonance branch (spec §6.4).
 *
 * Motes trickle from Tier-1 orbiter throughput and buy a small tree of
 * multipliers. Resonance self-feeds (boosts Mote gain) and is softcapped.
 */
import { BAL, RepeatableUpgradeDef } from '../balance';
import { D, Decimal, ONE, ZERO, clean, softcap } from '../numbers';
import { GameState } from '../types';
import { challengeActive, challengeMoteMult } from './challengeperks';
import { elementMoteMult } from './elements';
import { starMoteMult } from './starchart';
import { upgradeCost, upgradeMaxed, upgradeMult } from './upgrades';

const moteDefs = new Map(BAL.motes.upgrades.map((u) => [u.id, u]));

export function moteUpgradeDef(id: string): RepeatableUpgradeDef | undefined {
  return moteDefs.get(id);
}

export function moteUpgradeLevel(state: GameState, id: string): number {
  return state.moteUpgrades[id] ?? 0;
}

/** Composed, softcapped Resonance multiplier on Mote gain. */
export function resonanceMult(state: GameState): Decimal {
  const def = moteDefs.get('resonance');
  if (!def) return ONE;
  const raw = upgradeMult(def, moteUpgradeLevel(state, 'resonance'));
  return softcap(raw, BAL.softcap.resonance.t, BAL.softcap.resonance.p);
}

/** Motes per second: base·√T1 × resonance × stars × elements × grid × rewards. */
export function moteRate(state: GameState): Decimal {
  // Famine challenge: Motes disabled during the run.
  if (challengeActive(state, 'famine')) return ZERO;
  const t1 = state.dims[0]?.amount ?? ZERO;
  if (t1.lte(ZERO)) return ZERO;
  const abundance = D(3).pow(state.prismGrid['abundance'] ?? 0);
  return clean(
    BAL.motes.base
      .mul(t1.sqrt())
      .mul(resonanceMult(state))
      .mul(starMoteMult(state))
      .mul(elementMoteMult(state))
      .mul(abundance)
      .mul(challengeMoteMult(state)),
  );
}

/** Advance Mote accrual by dt seconds. Mutates `state`. */
export function tickMotes(state: GameState, dt: number): void {
  const gained = moteRate(state).mul(dt);
  if (gained.lte(ZERO)) return;
  state.motes = clean(state.motes.add(gained));
  state.motesEver = clean(state.motesEver.add(gained));
}

/** Buy one level of a Mote upgrade if affordable. Returns true on purchase. */
export function buyMoteUpgrade(state: GameState, id: string): boolean {
  const def = moteDefs.get(id);
  if (!def) return false;
  const level = moteUpgradeLevel(state, id);
  if (upgradeMaxed(def, level)) return false;
  const cost = upgradeCost(def, level);
  if (state.motes.lt(cost)) return false;
  state.motes = state.motes.sub(cost);
  state.moteUpgrades = { ...state.moteUpgrades, [id]: level + 1 };
  return true;
}

/** The Motes tab reveals once the trickle has ever produced anything. */
export function motesUnlocked(state: GameState): boolean {
  return state.motesEver.gt(ZERO);
}
