/**
 * Automation v1 (spec §8.7): after the first Collapse, autobuyers for
 * Tiers 1–3, Spark upgrades and Mote upgrades. Tier 4 joins via the
 * Fourth Servo star node; tiers 5+ arrive with P2.
 *
 * Every autobuyer has an on/off toggle (missing entry = ON). A pass runs
 * every `autobuyInterval(state)` seconds (Swift Servos halves it per level),
 * buying from the highest automated tier down so upper tiers are not starved
 * by Tier 1 draining the Spark first.
 */
import { GameState } from '../types';
import { buyDim } from './dimensions';
import { buyMoteUpgrade } from './motes';
import { autobuyInterval } from './shardperks';
import { starAutobuyTier } from './starchart';
import { buySparkUpgrade } from './upgrades';
import { BAL } from '../balance';

export const AUTOMATION_IDS = [
  'dim1',
  'dim2',
  'dim3',
  'dim4',
  'sparkUpgrades',
  'moteUpgrades',
] as const;
export type AutomationId = (typeof AUTOMATION_IDS)[number];

export function automationUnlocked(state: GameState): boolean {
  return state.collapses > 0;
}

/** Does this autobuyer exist yet for this player? */
export function autobuyerAvailable(state: GameState, id: AutomationId): boolean {
  if (!automationUnlocked(state)) return false;
  if (id === 'dim4') return starAutobuyTier(state, 4);
  return true;
}

/** Toggle state: missing = ON. */
export function autobuyerEnabled(state: GameState, id: AutomationId): boolean {
  return state.automation[id] !== false;
}

export function toggleAutobuyer(state: GameState, id: AutomationId): void {
  state.automation = { ...state.automation, [id]: !autobuyerEnabled(state, id) };
}

/** Run 0..n autobuyer passes for dt elapsed seconds. Mutates `state`. */
export function tickAutomation(state: GameState, dt: number): void {
  if (!automationUnlocked(state)) return;
  state.autobuyTimer += dt;
  const interval = autobuyInterval(state);
  // A long dt (offline chunks) is one pass, not hundreds: passes are
  // idempotent-ish (buy MAX), so replaying them buys nothing extra.
  if (state.autobuyTimer < interval) return;
  state.autobuyTimer = state.autobuyTimer % interval;
  runAutobuyPass(state);
}

function runAutobuyPass(state: GameState): void {
  // Highest automated tier first.
  for (const [id, tier] of [
    ['dim4', 4],
    ['dim3', 3],
    ['dim2', 2],
    ['dim1', 1],
  ] as const) {
    if (autobuyerAvailable(state, id) && autobuyerEnabled(state, id)) {
      buyDim(state, tier, 'MAX');
    }
  }

  if (autobuyerAvailable(state, 'sparkUpgrades') && autobuyerEnabled(state, 'sparkUpgrades')) {
    for (const def of BAL.sparkUpgrades) {
      // Bounded loop: buy at most a handful of levels per pass so a pass
      // stays cheap even with absurd wealth.
      for (let i = 0; i < 10 && buySparkUpgrade(state, def.id); i++);
    }
  }

  if (autobuyerAvailable(state, 'moteUpgrades') && autobuyerEnabled(state, 'moteUpgrades')) {
    for (const def of BAL.motes.upgrades) {
      for (let i = 0; i < 10 && buyMoteUpgrade(state, def.id); i++);
    }
  }
}
