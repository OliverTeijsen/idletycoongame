/**
 * Automation v1 (spec §8.7): after the first Collapse, autobuyers for
 * Tiers 1–3, Spark upgrades and Mote upgrades. Tier 4 joins via the
 * Fourth Servo star node; tiers 5+ arrive with P2.
 *
 * Every autobuyer has an on/off toggle (missing entry = ON). A pass runs
 * every `autobuyInterval(state)` seconds (Swift Servos halves it per level),
 * buying from the highest automated tier down so upper tiers are not starved
 * by Tier 1 draining the Spark first.
 *
 * The PRESTIGE TREES are deliberately never automated — not the Star Chart,
 * the Prism grid, the Aeon grid, Research or the Meta Shop. Those are the
 * choices the game is actually made of; a pass that spent them for you would
 * leave the player watching. What IS automated is the repetitive part: the
 * orbiter chain, the two cheap upgrade branches, and the resets themselves.
 */
import { GameState } from '../types';
import { buyDim, canDimBoost, doDimBoost } from './dimensions';
import { buyResearchGrid } from './minerals';
import { buyMoteUpgrade } from './motes';
import {
  buyAeonGrid,
  buyMetaGrid,
  buyPrismUpgrade,
  buyShardUpgrade,
  doAscend,
  doCollapse,
  doConverge,
  doUnify,
  worthAscending,
  worthCollapsing,
  worthConverging,
  worthUnifying,
} from './prestige';
import { autobuyInterval } from './shardperks';
import { starAutobuyTier } from './starchart';
import { buySparkUpgrade } from './upgrades';
import { BAL } from '../balance';

export const AUTOMATION_IDS = [
  'dim1',
  'dim2',
  'dim3',
  'dim4',
  'dim5',
  'dim6',
  'dim7',
  'dim8',
  'sparkUpgrades',
  'moteUpgrades',
  'dimBoost',
  'autoCollapse',
  'autoAscend',
  'autoConverge',
  'autoUnify',
] as const;
export type AutomationId = (typeof AUTOMATION_IDS)[number];

export function automationUnlocked(state: GameState): boolean {
  return state.collapses > 0 || state.ascends > 0;
}

/**
 * Does this autobuyer exist yet? P1: tiers 1–3 + upgrades. The Fourth Servo
 * star node adds tier 4. P2 (Ascend): all tiers + auto-Dimension-Boost
 * (spec §8.7 table).
 */
export function autobuyerAvailable(state: GameState, id: AutomationId): boolean {
  if (!automationUnlocked(state)) return false;
  // Auto-Collapse is a structural Aeon-tree perk, not a P2 unlock.
  if (id === 'autoCollapse') return state.aeonTree['autoCollapse'] === true;
  // Auto-prestige of the deeper layers comes from the Meta Shop (P4).
  if (id === 'autoAscend') return state.metaShop['autoAscend'] === true;
  if (id === 'autoConverge') return state.metaShop['autoConverge'] === true;
  if (id === 'autoUnify') return state.metaShop['autoUnify'] === true;
  if (state.ascends > 0) return true;
  if (id === 'dim4') return starAutobuyTier(state, 4);
  if (id === 'dim5' || id === 'dim6' || id === 'dim7' || id === 'dim8' || id === 'dimBoost')
    return false;
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
  /*
   * UPGRADES BEFORE ORBITERS. The order is the whole correctness of this pass.
   *
   * The orbiter autobuyers buy MAX, which by definition spends every Spark you
   * have. Run them first — as this did — and the Spark-upgrade autobuyer below
   * finds an empty wallet on every single pass, forever: the toggle is on, the
   * player believes their upgrades are being bought, and they are not. It is a
   * silent, permanent stall of the branch that holds the game's compounding
   * multipliers.
   *
   * Upgrades also deserve to go first on the merits. They are permanent within
   * a run (and the Mote branch survives Collapse with Mote Echo), while
   * orbiters are wiped by the next Dimension Boost — and their geometric costs
   * make them self-limiting, so they cannot starve the orbiters in turn.
   */
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

  // Highest automated tier first, so upper tiers are not starved by Tier 1
  // draining the Spark ahead of them.
  for (const [id, tier] of [
    ['dim8', 8],
    ['dim7', 7],
    ['dim6', 6],
    ['dim5', 5],
    ['dim4', 4],
    ['dim3', 3],
    ['dim2', 2],
    ['dim1', 1],
  ] as const) {
    if (autobuyerAvailable(state, id) && autobuyerEnabled(state, id)) {
      buyDim(state, tier, 'MAX');
    }
  }

  if (
    autobuyerAvailable(state, 'dimBoost') &&
    autobuyerEnabled(state, 'dimBoost') &&
    canDimBoost(state)
  ) {
    doDimBoost(state);
  }

  // Auto-prestige LAST, and deepest layer first so a shallow reset never
  // wastes a deep one queued in the same pass. All four share the
  // sensible-player rule from prestige.ts (worth*), which is also what the
  // balance harness plays. Never during a challenge run — it would wipe
  // progress toward the goal.
  if (state.activeChallenge === null) {
    if (
      autobuyerAvailable(state, 'autoUnify') &&
      autobuyerEnabled(state, 'autoUnify') &&
      worthUnifying(state)
    ) {
      doUnify(state);
    }

    if (
      autobuyerAvailable(state, 'autoConverge') &&
      autobuyerEnabled(state, 'autoConverge') &&
      worthConverging(state)
    ) {
      doConverge(state);
    }

    if (
      autobuyerAvailable(state, 'autoAscend') &&
      autobuyerEnabled(state, 'autoAscend') &&
      worthAscending(state)
    ) {
      doAscend(state);
    }

    if (
      autobuyerAvailable(state, 'autoCollapse') &&
      autobuyerEnabled(state, 'autoCollapse') &&
      worthCollapsing(state)
    ) {
      doCollapse(state);
    }
  }

}

